import './config/loadEnv';
import crypto from 'crypto';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { appBaseUrl, webhookUrl } from './appBase';
import { connectDB } from './config/dbconfig';
import {
  assertRepoAdmin,
  createRepoWebhook,
  deleteRepoWebhook,
  exchangeOAuthCode,
  fetchGithubUser,
  listOwnedRepos,
} from './github';
import { HttpError } from './httpError';
import { requireLogin } from './middleware/requireLogin';
import { ConnectedRepo } from './models/ConnectedRepo';
import { DeliveryEvent } from './models/DeliveryEvent';
import { User } from './models/User';
import { publicError } from './publicError';
import { encryptSecret, decryptSecret } from './secrets';
import { acceptGithubDelivery, retryFailedActions } from './webhook/handle';
import { verifyGithubSignature } from './webhook/verify';

const PORT = Number(process.env.PORT || 3000);
const app = express();

function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function takeFlash(req: Request): { type: 'error' | 'ok'; message: string } | null {
  const flash = req.session.flash ?? null;
  delete req.session.flash;
  return flash;
}

function setFlash(req: Request, type: 'error' | 'ok', message: string): void {
  req.session.flash = { type, message: message.slice(0, 300) };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is missing`);
    process.exit(1);
  }
  return value;
}

const mongoUrl = requiredEnv('MONGO_DB_URL');
const sessionSecret = requiredEnv('SESSION_SECRET');
requiredEnv('GITHUB_WEBHOOK_SECRET');

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.resolve('src/views'));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl, ttl: 60 * 60 * 24 * 7 }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as Request).rawBody = Buffer.from(buf);
    },
  }),
);

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/login', (req, res) => {
  if (req.session.userId) {
    res.redirect('/');
    return;
  }
  res.render('login', {
    oauthReady: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    error: null,
  });
});

app.get('/auth/github', (req, res, next) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
    res.status(500).send('GitHub OAuth is not configured');
    return;
  }
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  const redirectUri = `${appBaseUrl()}/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user repo',
    state,
  });
  req.session.save((error) => {
    if (error) {
      next(error);
      return;
    }
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });
});

app.get('/auth/github/callback', asyncRoute(async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!state || state !== req.session.oauthState) {
    res.status(403).send('Invalid OAuth state');
    return;
  }
  if (!code) {
    res.status(400).send('Missing OAuth code');
    return;
  }

  try {
    const redirectUri = `${appBaseUrl()}/auth/github/callback`;
    const token = await exchangeOAuthCode(code, redirectUri);
    const profile = await fetchGithubUser(token);
    const user = await User.findOneAndUpdate(
      { githubId: profile.id },
      {
        $set: {
          login: profile.login,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          accessTokenEnc: encryptSecret(token),
        },
      },
      { upsert: true, new: true },
    );
    const userId = String(user._id);
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = userId;
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });
    res.redirect('/');
  } catch (error) {
    console.error('GitHub sign-in failed:', publicError(error));
    res.status(401).render('login', {
      oauthReady: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      error: 'GitHub sign-in failed. Check that the OAuth callback URL matches APP_BASE_URL and try again.',
    });
  }
}));

app.post('/logout', requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.post('/webhook', asyncRoute(async (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
  const signature = req.get('x-hub-signature-256');
  if (!verifyGithubSignature(req.rawBody, signature, secret)) {
    res.status(401).send('Invalid signature');
    return;
  }

  try {
    const result = await acceptGithubDelivery(req.headers, req.body);
    res.status(200).send(result);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).send(error.message);
      return;
    }
    console.error('Webhook processing failed:', publicError(error));
    res.status(500).send('unavailable');
  }
}));

app.get('/', requireLogin, asyncRoute(async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    req.session.destroy(() => res.redirect('/login'));
    return;
  }

  const connected = await ConnectedRepo.findOne({ userId: user._id }).lean();
  const label = typeof req.query.label === 'string' ? req.query.label : '';
  const repo = typeof req.query.repo === 'string' ? req.query.repo : '';
  const filter: Record<string, unknown> = {};
  if (connected) {
    filter.fullName = connected.fullName;
  } else {
    filter.fullName = '__none__';
  }
  if (repo && (!connected || repo !== connected.repo)) {
    filter.fullName = '__none__';
  }
  if (label) {
    filter.labelsToApply = label;
  }

  const events = await DeliveryEvent.find(filter).sort({ receivedAt: -1 }).limit(100).lean();
  let repos: { fullName: string; private: boolean }[] = [];
  let reposError = '';
  try {
    const tokenUser = await User.findById(user._id).select('+accessTokenEnc');
    if (tokenUser?.accessTokenEnc) {
      repos = await listOwnedRepos(decryptSecret(tokenUser.accessTokenEnc));
    }
  } catch (error) {
    reposError = publicError(error);
  }

  res.render('dashboard', {
    user,
    connected,
    repos,
    reposError,
    events,
    label,
    repo,
    flash: takeFlash(req),
    webhookWarning: appBaseUrl().includes('localhost') || appBaseUrl().startsWith('http://'),
    webhookTarget: webhookUrl(),
  });
}));

app.post('/repos/connect', requireLogin, asyncRoute(async (req, res) => {
  const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
  const parts = fullName.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    setFlash(req, 'error', 'Choose a repository you own.');
    res.redirect('/');
    return;
  }
  const [owner, repo] = parts;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    setFlash(req, 'error', 'GITHUB_WEBHOOK_SECRET is not set.');
    res.redirect('/');
    return;
  }

  const tokenUser = await User.findById(req.session.userId).select('+accessTokenEnc');
  if (!tokenUser?.accessTokenEnc) {
    res.redirect('/login');
    return;
  }
  const token = decryptSecret(tokenUser.accessTokenEnc);

  try {
    await assertRepoAdmin(token, owner, repo);
    const previous = await ConnectedRepo.findOne({ userId: tokenUser._id });
    if (previous && previous.fullName !== fullName) {
      await deleteRepoWebhook(token, previous.owner, previous.repo, previous.webhookId);
      await previous.deleteOne();
    }
    const taken = await ConnectedRepo.findOne({ fullName, userId: { $ne: tokenUser._id } });
    if (taken) {
      setFlash(req, 'error', 'Another account is already connected to that repository.');
      res.redirect('/');
      return;
    }
    const webhookId = await createRepoWebhook(token, owner, repo, webhookUrl(), secret);
    await ConnectedRepo.findOneAndUpdate(
      { userId: tokenUser._id },
      { $set: { owner, repo, fullName, webhookId } },
      { upsert: true, new: true },
    );
    setFlash(req, 'ok', `Connected ${fullName}. GitHub will send issues and pull requests to this app.`);
  } catch (error) {
    setFlash(req, 'error', publicError(error));
  }
  res.redirect('/');
}));

app.post('/repos/disconnect', requireLogin, asyncRoute(async (req, res) => {
  const tokenUser = await User.findById(req.session.userId).select('+accessTokenEnc');
  const connected = await ConnectedRepo.findOne({ userId: req.session.userId });
  if (!tokenUser?.accessTokenEnc || !connected) {
    res.redirect('/');
    return;
  }
  try {
    await deleteRepoWebhook(decryptSecret(tokenUser.accessTokenEnc), connected.owner, connected.repo, connected.webhookId);
    await connected.deleteOne();
    setFlash(req, 'ok', `Disconnected ${connected.fullName}.`);
  } catch (error) {
    setFlash(req, 'error', publicError(error));
  }
  res.redirect('/');
}));

app.post('/events/:id/delete', requireLogin, asyncRoute(async (req, res) => {
  const connected = await ConnectedRepo.findOne({ userId: req.session.userId });
  if (!connected || !mongoose.isValidObjectId(req.params.id)) {
    res.redirect('/');
    return;
  }
  await DeliveryEvent.deleteOne({ _id: req.params.id, fullName: connected.fullName });
  res.redirect('/');
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(publicError(error));
  if (res.headersSent) {
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).send('Invalid JSON');
    return;
  }
  res.status(500).send('Something went wrong');
});

async function main(): Promise<void> {
  await connectDB();
  await Promise.all([User.syncIndexes(), ConnectedRepo.syncIndexes(), DeliveryEvent.syncIndexes()]);
  app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
    const timer = setInterval(() => {
      void retryFailedActions();
    }, 60_000);
    timer.unref();
  });
  void retryFailedActions();
}

void main().catch((error) => {
  console.error(publicError(error));
  process.exit(1);
});
