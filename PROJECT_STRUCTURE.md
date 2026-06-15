# Nose Tea Onboarding Structure

This project now has a safer handoff structure so it is easier to continue in Codex, Cloudflare, or another editor.

## Frontend

- `cloudflare-pages/index.html`
  - Thin HTML entry point only
- `cloudflare-pages/assets/styles.css`
  - All page styling
- `cloudflare-pages/assets/app.js`
  - LIFF boot, web login, portal rendering, admin dashboard UI

## Worker API

- `cloudflare-worker/src/worker.js`
  - Main route entry
- `cloudflare-worker/src/lib/core.js`
  - Shared helpers, response builders, public mappers
- `cloudflare-worker/src/lib/task-queries.js`
  - Reusable task lookup query helpers
- `cloudflare-worker/src/lib/flex.js`
  - LINE Flex message builders

## Data

- `cloudflare-worker/schema.sql`
  - Base schema snapshot

## Recommended next split

To keep moving toward production, the next clean extraction should be:

1. `cloudflare-worker/src/routes/admin.js`
2. `cloudflare-worker/src/routes/portal.js`
3. `cloudflare-worker/src/routes/messages.js`
4. `cloudflare-worker/src/services/task-service.js`
5. `cloudflare-worker/src/services/group-service.js`

## Deployment reminder

After any update:

1. Deploy `cloudflare-pages`
2. Deploy `cloudflare-worker`
3. Re-test:
   - register
   - admin dashboard
   - create group
   - create session
   - force task
   - send LINE flex
   - open LIFF as mentor / mentee
