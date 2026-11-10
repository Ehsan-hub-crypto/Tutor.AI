---open pasted 2026-11-11 at 2.04.54 ... file 
- click raw view
- go to download
- open the folder
- copy the URL
- past in the browser to preview the tutor.AI 

# Tutor.AI — Make it click

A study companion that turns a question or study material into a plain-language explanation, an everyday analogy, ordered steps, and a short quiz.

## Features

- **Tutor.AI:** explanations, analogies, step-by-step answers, interactive quizzes, copyable/printable study notes, and downloadable handwritten-style note cards.
- **Accounts and history:** sign up with a username and password, stay signed in for 30 days, and revisit or clear your saved conversations.
- **Attachments:** PNG, JPEG, GIF, WebP, PDF, DOCX, and TXT files up to 4 MB. DOCX and TXT text extraction happens in the browser. Images and PDFs are sent to the backend only when you submit a question.
- **Backend-only private data:** passwords are hashed with scrypt, sessions are stored as hashes in SQLite, and the Gemini key stays in the Node.js server environment.
- **Accessible, responsive UI:** keyboard-operable tabs and quiz options, visible focus states, reduced-motion support, and mobile layouts.

## Run locally

Requires Node.js 20 or later and npm. From this directory:

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and add your Gemini API key after `GEMINI_API_KEY=`. Keep `.env` on your machine; it is ignored by Git. Never paste the key into chat or commit it.
3. Start the server:

   ```sh
   npm start
   ```

4. Open `http://localhost:3000`, create an account, and sign in. The SQLite database is created automatically in `data/`. **Do not open `index.html` directly from Finder**; accounts and AI answers require the running Node.js server.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | For AI answers | Google Gemini credential, set only on the backend host. |
| `GEMINI_MODEL` | No | Gemini model identifier; defaults to `gemini-3.5-flash-lite`. Model access and quotas depend on your Google AI Studio project. |
| `PORT` | No | HTTP port; defaults to `3000` and is usually provided by the hosting service. |
| `TUTOR_DATABASE_PATH` | No | SQLite database file path; defaults to `data/tutor.sqlite` beside `server.js`. Use a persistent disk in production. |
| `ALLOWED_ORIGINS` | For a separate frontend origin | Comma-separated exact frontend origins, e.g. `https://tutor.example.com`. Do not include paths or a trailing slash. |
| `TRUST_PROXY` | Hosting-dependent | Set to `true` only when deployed behind a trusted reverse proxy that sets `X-Forwarded-For` and `X-Forwarded-Proto`. |
| `TUTOR_RATE_LIMIT` | No | Per-IP request limit per 10-minute window; defaults to `15` (allowed range 1–1000). |
| `TUTOR_GLOBAL_RATE_LIMIT` | No | Per-process explanation limit per 10-minute window; defaults to `30` (allowed range 1–1000). |

The server loads `.env` automatically for local development. On a hosting provider, configure `GEMINI_API_KEY` using its secret environment-variable settings instead. Never put the key in `tutor-config.js`, browser code, GitHub Pages settings, or a public issue. If a key is accidentally shared, revoke it and create a replacement. Back up the SQLite database securely: it contains account records, session hashes, and saved questions and answers.


## Deployment

### Deploy Tutor.AI

Deploy this subproject as a Node.js web service on a host that runs Node applications and provides persistent disk storage. If the repository contains other projects, set the service's root directory to `tutor-ai/`. Use `npm install` and `npm start` as the install/start commands, set `GEMINI_API_KEY` in the host's secret environment-variable settings, and mount persistent storage for `TUTOR_DATABASE_PATH`. Without persistent storage, accounts and history may disappear when the service is redeployed or restarted. Public deployments must use HTTPS; configure `TRUST_PROXY=true` when the service is behind its trusted TLS-terminating reverse proxy. The service serves Tutor.AI and its API together, so `tutor-config.js` can keep its default empty API base URL.

### Separate frontend

**GitHub Pages cannot run `server.js`, store the account database, or securely host `GEMINI_API_KEY`.** A static deployment by itself does not support sign-in or saved history. For a separate frontend and backend, use a frontend origin on the same site as the API (for example, sibling subdomains) so browsers can send the secure session cookie. Cross-site hosting may block cookies even when CORS is configured.

For a separate frontend and Node backend:

1. Set `GEMINI_API_KEY` on the Node host.
2. Add the exact frontend origin to the backend's `ALLOWED_ORIGINS`; the backend uses credentialed CORS for the session cookie.
3. Set `window.TUTOR_API_BASE_URL` in this subproject's `tutor-config.js` to the backend's public HTTPS origin, such as `https://your-api.example.com`.
4. Set `TUTOR_DATABASE_PATH` to a file on persistent storage and set `TRUST_PROXY=true` only if the backend host sits behind its trusted proxy.

The API base URL is public configuration, not a secret. Never put the Gemini key in a repository variable used by browser assets. Same-origin deployment is recommended; the session cookie is HTTP-only, secure over HTTPS, and restricted to same-site requests.

## Privacy and security notes

- Tutor questions, extracted text, and attached image/PDF content are sent through your backend to Google Gemini for a response. Review Google's current Gemini API pricing, quota, and data-use terms before deployment; free-tier availability and limits can change. Avoid including personal, confidential, or sensitive information.
- Accounts are self-service and do not require email verification. Password reset and account recovery are not implemented; users should keep their password safe.
- Passwords are never stored as plain text. The backend hashes passwords with scrypt and stores only a hash of each random, 30-day session token.
- Each account keeps its 100 most recent conversations. Questions and generated answers are stored in the SQLite database until the user clears history; uploaded files themselves are not stored. DOCX/TXT contents pasted into the question field are saved as part of that question.
- Authentication and history require a signed-in account. Provider spending limits and hosting/edge rate limits are still recommended. The included per-IP and global in-memory limits are basic safeguards; they reset when the process restarts and are not shared across instances.
- The backend validates requests, file signatures and sizes, bounds text and model output, restricts browser origins, rate-limits sign-in attempts, and scopes conversation queries to the signed-in user. CORS is not authentication; non-browser clients still need a valid session.
- DOCX parsing is local and restricted to the document XML entry with decompression limits. Unsupported or malformed files are rejected.

## Suggested project description

**An AI study companion with personal accounts and saved conversation history, clear explanations, step-by-step breakdowns, quizzes, and downloadable notes.**
