# Nose Tea Onboarding: Cloudflare Deploy Guide

This guide explains how to run the production stack on Cloudflare using:

- `cloudflare-pages/` for the LIFF frontend
- `cloudflare-worker/` for the API
- Cloudflare D1 for the main database

## 1. Project structure

- `cloudflare-pages/`
  - static frontend for HR, mentor, mentee, and registration
- `cloudflare-worker/`
  - API, LINE push logic, scheduling logic, and D1 access
- `PROJECT_STRUCTURE.md`
  - handoff summary of the code layout

## 2. What gets deployed where

### Pages project

Deploy this folder:

`cloudflare-pages`

This should serve:

- `https://your-pages-domain/`

### Worker project

Deploy this folder/codebase:

`cloudflare-worker`

This should serve:

- `https://your-worker-domain/`

Example already used in this project:

- Pages: `https://noseneaonboarding65.pages.dev/`
- Worker: `https://nose-tea-onboarding-api.hrtraining.workers.dev/`

## 3. D1 database binding

Create or reuse a D1 database, then bind it to the Worker using binding name:

`DB`

The Worker expects that exact binding name.

## 4. Worker variables and secrets

Set these in the Worker settings.

### Plaintext variables

- `LINE_LOGIN_CHANNEL_ID`
- `ADMIN_EMAILS`

Example:

- `LINE_LOGIN_CHANNEL_ID=2010372532`
- `ADMIN_EMAILS=hrtraining@nosetea.com`

### Secrets

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_LOGIN_CHANNEL_SECRET` if your current Worker code uses LINE Login token verification

Notes:

- `LINE_CHANNEL_ACCESS_TOKEN` is used for push messages and Flex messages
- `LINE_LOGIN_CHANNEL_SECRET` is needed when verifying LINE Login / LIFF identity tokens server-side

## 5. Pages environment variables

If the frontend reads runtime config from the browser layer, define these in Pages settings if needed:

- `API_BASE_URL`
- `LIFF_ID`

Recommended values:

- `API_BASE_URL=https://your-worker-domain`
- `LIFF_ID=your-liff-id`

If your frontend currently hardcodes them in `app.js`, keep those values aligned with production.

## 6. LINE setup

### LIFF endpoint

In LINE Developers, set the LIFF Endpoint URL to your Pages site:

- `https://your-pages-domain/`

Do not point LIFF at the Worker root.

### LINE Login callback

Set the LINE Login callback URL to your Pages site root as well, unless you intentionally route callback handling elsewhere:

- `https://your-pages-domain/`

If your login flow uses a specific callback path, use that exact path consistently in:

- LINE Developers
- frontend redirect logic
- Worker verification logic

## 7. Deployment order

When you change both frontend and backend, deploy in this order:

1. Deploy Worker
2. Confirm Worker health endpoint / test endpoint works
3. Deploy Pages
4. Re-test LIFF open
5. Re-test registration
6. Re-test HR dashboard
7. Re-test mentor and mentee flows

Reason:

- frontend usually depends on the API already being live

## 8. Recommended deploy checklist

### Worker

1. Open Worker settings
2. Confirm variables and secrets exist
3. Confirm D1 binding `DB` exists
4. Deploy Worker
5. Open:
   - `https://your-worker-domain/`
6. Expected:
   - root may return `{"ok":false,"error":"Not found."}` and that is acceptable if no root route is defined

### Pages

1. Open Pages project
2. Upload/deploy contents of `cloudflare-pages/`
3. Wait for deploy success
4. Open:
   - `https://your-pages-domain/`
5. Expected:
   - frontend loads without `Failed to fetch`

## 9. If frontend says "Failed to fetch"

Usually one of these is wrong:

1. `API_BASE_URL` points to the wrong Worker URL
2. Worker is not deployed
3. Worker variables/secrets are missing
4. Worker has no D1 binding `DB`
5. CORS is not configured for browser access

## 10. Production smoke test

After each deploy, test this exact order:

1. Open Pages root in desktop browser
2. Open Pages root inside LIFF
3. Register a mentor
4. Register a mentee
5. Open HR dashboard
6. Create group
7. Assign mentees and mentor
8. Create session/checkpoint
9. Trigger one test message
10. Open message in LINE
11. Open LIFF from the message
12. Submit one real task
13. Confirm task status updates in dashboard

## 11. Safe editing workflow

When making future changes:

1. Edit frontend in:
   - `cloudflare-pages/assets/app.js`
   - `cloudflare-pages/assets/styles.css`
2. Edit backend in:
   - `cloudflare-worker/src/worker.js`
   - `cloudflare-worker/src/lib/*.js`
3. Run syntax checks locally
4. Deploy Worker first
5. Deploy Pages second

## 12. Good next refactor

If you want even easier long-term maintenance, split `cloudflare-pages/assets/app.js` into:

- `config.js`
- `api.js`
- `state.js`
- `views/register.js`
- `views/admin.js`
- `views/mentor.js`
- `views/mentee.js`

That is optional, but recommended as the product grows.
