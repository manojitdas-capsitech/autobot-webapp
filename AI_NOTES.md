# AI notes

## Tools

I used Cursor’s agent in this repository. I described the assignment gap, asked for a plan, then asked it to implement that plan. I kept the decisions below and checked the running behavior against the logs (empty dashboard, Mongo checkpoint lines, and the “No matching labels found” message) instead of treating the generated code as done.

No `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` file was used. This repository does not contain one.

## Decisions I made

I kept MongoDB and Mongoose. The assignment allows any free database, and this project already stored label activity in Mongo. Moving to Postgres would have been a rewrite, not a requirement.

I used a GitHub OAuth App with the `repo` scope, not a GitHub App. Connecting one repository the user administers, creating a webhook, and applying labels can all be done with the user’s OAuth token. A GitHub App (JWT and installation tokens) is a stretch goal, so it is not the core path.

I store the webhook delivery before calling GitHub or Slack, and I unique-index `X-GitHub-Delivery`. That is the difference between “GitHub might retry” and “we still have the event if Slack is down, and we do not label twice when GitHub retries.”

## Hardest wrong turn

The bot looked connected to Mongo and still saved nothing. Two separate mistakes stacked.

First, `MONGO_DB_URL` lived in `.env.docker`, while `dotenv.config()` only reads `.env`. Docker Compose also replaced that variable with `mongodb://mongo:27017/github-bot`, so the Atlas URL in the env file never reached the process. The fix was to load `.env` and then `.env.docker`, and to pass `.env.docker` into the container instead of hardcoding a different URL.

Second, the handler logged `No matching labels found` and returned before `LabelEvent.create`. The Mongo container still printed WiredTiger checkpoint lines. Those look like database writes, but they are periodic checkpoints, not application inserts. The dashboard query `{ events: [] }` was the real signal: the collection was empty because the code exited first. I noticed by comparing that log line with the source return, not with the checkpoint noise. The handler now records the delivery even when there is nothing to label, and a failed GitHub or Slack call is stored and retried instead of dropping the event.

## With more time

I would add a rules form in the dashboard, a free Gemini or Groq summary on the Slack message, more than one repository per user, and a page that shows only failed actions and retry counts. I would also replace the broad keyword list (it treats the word “issue” as a bug signal) with rules the user can edit.
