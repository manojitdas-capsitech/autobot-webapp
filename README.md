# GitHub Auto-Issue Labeler Bot + Dashboard

A GitHub bot that automatically labels **Issues** and **Pull Requests** using a rule-based engine and optionally, ML-powered classification. Includes a web dashboard to visualize and filter all contributor activity.

> Built with TypeScript, Express, MongoDB, and EJS — ready for CI/CD, Docker, and extensibility with NLP models like DistilBERT.

---

## Motivation

Open-source projects often lack consistent labeling for Issues and PRs, leading to confusion and slower triage. This project solves that by providing a pluggable, extensible bot that ensures consistent labels using rule-based triggers or an optional ML classifier — all visualized in a dashboard.

---

## Inspiration

- [`Probot`](https://probot.github.io/)
- GitHub's built-in auto-labeling (limited)

---
## Features

- Auto-labels GitHub Issues & PRs based on title/body
- Supports rule-based and (optional) ML-based classification
- Real-time webhook listener (`issues`, `pull_request`)
- MongoDB-backed persistence of events
- Filterable dashboard UI (label, repo)
- Designed for Vercel (frontend) + Railway (backend)

---

## Design Decisions

- **Hybrid Labeling Engine**: Chose rule-based classification as a fast, transparent default. ML integration is optional and modular.
- **Webhook-Driven**: Listens to GitHub webhooks to avoid polling and ensure near-instant response.
- **Dashboard Simplicity**: Server-rendered with EJS to reduce frontend complexity and dependency overhead.
- **Deployment Flexibility**: Compatible with Railway (backend) and Vercel (dashboard).

---

## Architecture

```text
+------------------+       +-------------------+       +-----------------------+
|  GitHub Webhook  +------>+  Express Webhook  +------>+  Label Engine         |
|  Events (PRs)    |       |  Listener (Node)  |       |  (Keyword + ML)       |
+------------------+       +-------------------+       +----------+------------+
                                                                    |
                                                                    v
                                                      +---------------------------+
                                                      |  MongoDB (Activity Logs)  |
                                                      +------------+--------------+
                                                                   |
                                                                   v
                                                      +---------------------------+
                                                      |     Dashboard (EJS)       |
                                                      +---------------------------+
## 🛠️ Tech Stack

| Layer         | Tech Stack                                      |
|---------------|--------------------------------------------------|
| **Backend**   | Node.js, Express, TypeScript                    |
| **Database**  | MongoDB Atlas (via Mongoose)                    |
| **Frontend**  | EJS, HTML, Vanilla CSS                          |
| **Webhook**   | GitHub Webhooks (`issues`, `pull_request`)      |
| **Optional ML**| Python, Huggingface Transformers (DistilBERT) |
| **Dev Tools** | ts-node-dev, dotenv, ngrok                      |
| **Future**    | Docker, GitHub Actions CI/CD                    |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ananyadua27/github-issue-labeler-bot.git
cd github-issue-labeler-bot

### 2. Install dependencies
```bash
npm install

### 3. Configure environment
Create a .env file in the root:
```bash
GITHUB_TOKEN=
MONGO_DB_URL=
PORT=3000

### 4. Start ngrok (if running locally)
```bash
npx ngrok http 3000

### 5. Start the server
```bash
npm run dev

## GitHub Webhook Setup

1. Go to your repository on GitHub
2. Navigate to **Settings → Webhooks**
3. Click **“Add webhook”**
4. Fill out the webhook form:
   - **Payload URL**: `https://<your-ngrok-or-deployed-url>/webhook`
   - **Content type**: `application/json`
   - **Secret**: _(optional, not required for MVP)_
   - **Events**: Choose:
     - Just the individual events →  _Issues_ and _Pull Requests_
5. Click **Add webhook**

Once configured, the bot will listen for:
- New issues
- New pull requests
- Edits to either

---

## Dashboard

> Deployable via Vercel, Railway, or your own Node server.

### Features:
-  **Auto-refreshing** table (every 60 seconds)
-  **Filter by label** (`bug`, `frontend`, `backend`, `docs`)
-  **Filter by repo name** (e.g., `my-repo`)
-  **Sorted by latest first**

### Demo:

![Demo](./assets/diagram1.png)
![Demo](./assets/diagram2.png)
---

## Smart Labeling Engine

### Rule-Based Matching

Defined in `labeler.ts` using keyword triggers:

| Label        | Trigger Keywords (Examples)                                     |
|--------------|-----------------------------------------------------------------|
| `bug`        | `error`, `fail`, `crash`, `timeout`, `broken`, `issue`         |
| `frontend`   | `.tsx`, `React`, `CSS`, `UI`, `layout`, `component`, `style`   |
| `backend`    | `api`, `server`, `auth`, `controller`, `express`, `mongoose`   |
| `docs`       | `README`, `.md`, `wiki`, `guide`, `documentation`              |
| `devops`     | `docker`, `CI`, `CD`, `workflow`, `pipeline`, `kubernetes`     |
| `test`       | `unit test`, `jest`, `cypress`, `mock`, `assert`, `coverage`   |
| `performance`| `optimize`, `latency`, `slow`, `profiling`, `throughput`       |
| `security`   | `xss`, `csrf`, `auth`, `token`, `permission`, `injection`      |
| `refactor`   | `clean`, `rename`, `simplify`, `tidy`, `modularize`            |

> Keywords can be extended easily to customize label logic per repo or team.

---

### 🤖 ML-Based Classification (Optional)

Optional microservice powered by **DistilBERT** via Hugging Face Transformers:

- Uses zero/few-shot learning on Issue/PR title + body
- Connect via internal API for async predictions
- Planned: fine-tuned classifier on open-source GitHub issue datasets

---

## Performance & Scalability

- Non-blocking, async webhook handlers via Express
- Efficient MongoDB querying with indexed fields
- ML inference runs asynchronously to avoid blocking webhook thread
- Can scale horizontally — stateless webhook architecture

---

## Security

- GitHub webhook signature verification (HMAC-SHA256) — *in roadmap*
- Environment variables stored securely (`.env`, GitHub secrets)
- Rate-limiting middleware (planned for production deployment)

---

## API Endpoints

| Method | Route           | Description                     |
|--------|------------------|---------------------------------|
| `POST` | `/webhook`       | Webhook listener for GitHub     |
| `GET`  | `/dashboard`     | Rendered UI with filters        |
| `GET`  | `/api/activity`  | JSON feed of recent activity    |

---

## License

MIT License — free to use, extend, and contribute.

