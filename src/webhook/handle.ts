import { IncomingHttpHeaders } from 'http';
import { applyLabels } from '../github';
import { getLabelsFromText, titleAsksForBugAlert } from '../labeler';
import { ConnectedRepo } from '../models/ConnectedRepo';
import { DeliveryEvent } from '../models/DeliveryEvent';
import { User } from '../models/User';
import { HttpError } from '../httpError';
import { publicError } from '../publicError';
import { decryptSecret } from '../secrets';
import { sendSlackMessage } from '../slack';

const MAX_ATTEMPTS = 5;
const inFlight = new Set<string>();

type BotAction = {
  kind: 'github_label' | 'slack';
  status: 'pending' | 'success' | 'failed' | 'skipped';
  detail: string;
  attempts: number;
};

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000;
}

async function tokenForRepo(owner: string, repo: string): Promise<string> {
  const connected = await ConnectedRepo.findOne({ owner, repo });
  if (!connected) {
    throw new Error('No signed-in user is connected to this repository');
  }
  const user = await User.findById(connected.userId).select('+accessTokenEnc');
  if (!user?.accessTokenEnc) {
    throw new Error('Connected GitHub user no longer exists');
  }
  return decryptSecret(user.accessTokenEnc);
}

async function executeAction(event: {
  owner: string;
  repo: string;
  number?: number | null;
  title: string;
  fullName: string;
  labelsToApply: string[];
  actions: BotAction[];
  markModified: (path: string) => void;
  save: () => Promise<unknown>;
}, action: BotAction): Promise<void> {
  if (action.status === 'success' || action.status === 'skipped' || action.attempts >= MAX_ATTEMPTS) {
    return;
  }

  action.attempts += 1;
  event.markModified('actions');
  await event.save();

  try {
    if (action.kind === 'github_label') {
      if (!event.labelsToApply.length || event.number == null) {
        action.status = 'skipped';
        action.detail = 'No keyword labels for this event';
      } else {
        const token = await tokenForRepo(event.owner, event.repo);
        await applyLabels(token, event.owner, event.repo, event.number, event.labelsToApply);
        action.status = 'success';
        action.detail = `Added ${event.labelsToApply.join(', ')}`;
      }
    } else {
      await sendSlackMessage(`Bug alert: ${event.fullName}#${event.number ?? '?'} — ${event.title}`);
      action.status = 'success';
      action.detail = 'Sent to Slack';
    }
  } catch (error) {
    action.status = 'failed';
    action.detail = publicError(error);
    console.error(`Action ${action.kind} failed for ${event.fullName}: ${action.detail}`);
  }

  event.markModified('actions');
  await event.save();
}

export async function processDelivery(eventId: string): Promise<void> {
  if (inFlight.has(eventId)) {
    return;
  }
  inFlight.add(eventId);
  try {
    const event = await DeliveryEvent.findById(eventId);
    if (!event) {
      return;
    }
    for (const action of event.actions) {
      if (action.status !== 'pending' && action.status !== 'failed') {
        continue;
      }
      await executeAction(event, action);
    }
  } finally {
    inFlight.delete(eventId);
  }
}

export async function retryFailedActions(): Promise<void> {
  const events = await DeliveryEvent.find({
    actions: { $elemMatch: { status: { $in: ['pending', 'failed'] }, attempts: { $lt: MAX_ATTEMPTS } } },
  }).limit(25);

  for (const event of events) {
    await processDelivery(String(event._id));
  }
}

export async function acceptGithubDelivery(headers: IncomingHttpHeaders, payload: unknown): Promise<'accepted' | 'duplicate' | 'ignored'> {
  const deliveryId = headerValue(headers['x-github-delivery']);
  const eventType = headerValue(headers['x-github-event']);
  if (!deliveryId || !eventType) {
    throw new HttpError(400, 'Missing GitHub delivery headers');
  }
  if (eventType === 'ping') {
    return 'ignored';
  }
  if (eventType !== 'issues' && eventType !== 'pull_request') {
    return 'ignored';
  }
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(400, 'Payload must be a JSON object');
  }

  const body = payload as {
    action?: unknown;
    repository?: { name?: unknown; owner?: { login?: unknown } };
    issue?: { number?: unknown; title?: unknown; body?: unknown };
    pull_request?: { number?: unknown; title?: unknown; body?: unknown };
  };
  const owner = body.repository?.owner?.login;
  const repo = body.repository?.name;
  if (typeof owner !== 'string' || typeof repo !== 'string') {
    throw new HttpError(400, 'Payload is missing repository');
  }

  const subject = eventType === 'issues' ? body.issue : body.pull_request;
  const title = typeof subject?.title === 'string' ? subject.title : '';
  const textBody = typeof subject?.body === 'string' ? subject.body : '';
  const githubAction = typeof body.action === 'string' ? body.action : '';
  const number = typeof subject?.number === 'number' ? subject.number : undefined;
  const shouldLabel = githubAction === 'opened' || githubAction === 'edited';
  const labelsToApply = shouldLabel ? getLabelsFromText(`${title}\n${textBody}`) : [];
  const notifySlack = githubAction === 'opened' && titleAsksForBugAlert(title);

  const actions: BotAction[] = [
    {
      kind: 'github_label',
      status: shouldLabel && labelsToApply.length > 0 ? 'pending' : 'skipped',
      detail: !shouldLabel
        ? 'Labeling runs when an issue or pull request is opened or edited'
        : labelsToApply.length > 0
          ? ''
          : 'No keyword labels for this event',
      attempts: 0,
    },
    {
      kind: 'slack',
      status: notifySlack ? 'pending' : 'skipped',
      detail: notifySlack ? '' : 'Slack alerts run when an opened issue or PR title contains "bug"',
      attempts: 0,
    },
  ];

  try {
    const doc = await DeliveryEvent.create({
      deliveryId,
      eventType,
      githubAction,
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      number,
      title,
      labelsToApply,
      actions,
    });
    await processDelivery(String(doc._id));
    return 'accepted';
  } catch (error) {
    if (isDuplicateKey(error)) {
      const existing = await DeliveryEvent.findOne({ deliveryId });
      if (existing) {
        await processDelivery(String(existing._id));
      }
      return 'duplicate';
    }
    throw error;
  }
}
