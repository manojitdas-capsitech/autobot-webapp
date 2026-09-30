# GitHub automation bot

A signed-in user connects a GitHub repository they administer. GitHub sends `issues` and `pull_request` webhooks to this app. The app checks the webhook signature, stores each delivery once, adds keyword labels on opened or edited issues and pull requests, and posts a Slack message when an opened title contains `bug`. The dashboard is available only after GitHub sign-in and lists those events plus the result of each action.

There is no `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` in this repo. See [AI_NOTES.md](AI_NOTES.md).

## Local setup

1. Create a [GitHub OAuth App](https://github.com/settings/developers). Set the authorization callback URL to `http://localhost:3000/auth/github/callback` while you run locally. The app requests the `read:user` and `repo` scopes so it can list repositories you own and create a webhook.
2. Create a [Slack incoming webhook](https://api.slack.com/messaging/webhooks) in a free workspace.
3. Copy the example env file and fill it in. Do not commit `.env`.

```bash
cp .env.example .env
```

On Windows PowerShell: `Copy-Item .env.example .env`

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID` | OAuth App client id |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `GITHUB_WEBHOOK_SECRET` | Secret sent to GitHub when the repo webhook is created. The app rejects deliveries that do not match it. Reconnect the repository if you change it. |
| `SESSION_SECRET` | Signs the login cookie and encrypts the GitHub access token at rest. Sign in again if you change it. |
| `MONGO_DB_URL` | MongoDB connection string. Atlas free tier, or `mongodb://localhost:27017/github-bot` if you start only the `mongo` service from Docker Compose. |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook URL. |
| `APP_BASE_URL` | Public origin with no trailing slash. Use `http://localhost:3000` locally. |
| `PORT` | HTTP port. Defaults to `3000`. |

4. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign in, and choose a repository. GitHub cannot deliver webhooks to localhost. Use the deployed URL below for a real delivery, or point `APP_BASE_URL` at a public HTTPS tunnel and put that same origin in the OAuth callback.

`npm run build` then `npm start` runs the compiled server.

## Deploy

The app is set up for [Render](https://render.com) free web services (no credit card) via [render.yaml](render.yaml).

1. Push this repository to GitHub.
2. In Render, create a Blueprint from the repo, or a new Web Service with build command `npm install && npm run build` and start command `npm start`.
3. Set every variable from `.env.example`. Use `NODE_ENV=production`. Set `APP_BASE_URL` to the Render URL, for example `https://github-automation-bot.onrender.com`, with no trailing slash.
4. In the GitHub OAuth App, set the authorization callback URL to `https://<your-render-host>/auth/github/callback`.
5. Open the Render URL, sign in, and connect a repository. That registers `https://<your-render-host>/webhook` for `issues` and `pull_request`.

The free service sleeps when idle. The first request after sleep can be slow. Events are stored before Slack or the GitHub label call runs, and failed actions are retried up to five times after the process is awake.

The live URL is the Render service URL after the blueprint is applied. Put that URL in this section before you submit. GitHub webhooks and the OAuth callback must use it, not localhost.

## How to test

Use your own GitHub account. There is no shared password.

1. Sign in on the deployed site and connect a repository you administer.
2. Open a new issue titled `bug: demo login fails`.
3. Confirm GitHub added labels (the title matches the `bug` rule), Slack received `Bug alert: ...`, and the dashboard shows the delivery with a success or failure for each action.
4. Open a second issue titled `Update the readme` and confirm it is logged. It should not send Slack, because the title does not contain `bug`.
5. Redeliver the same webhook from GitHub's webhook deliveries page. The dashboard should still show one row for that delivery id.

Sending a POST to `/webhook` without a valid `X-Hub-Signature-256` returns `401`.

## Behavior

- Login is required for the dashboard, connecting a repo, and deleting a log row.
- Webhook bodies are verified with HMAC SHA-256. The raw request body is what gets signed.
- `X-GitHub-Delivery` is unique. A repeat delivery does not label or notify again.
- If Slack or the GitHub API fails, the event stays in MongoDB with a failed action and is retried in the background.
- GitHub access tokens are encrypted with `SESSION_SECRET` and are not put in the cookie, the page, or logs.
