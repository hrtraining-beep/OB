# Nose Tea Cloudflare Worker Backend

This replaces Firebase Functions with Cloudflare Worker + D1.

## 1. Create D1 database

Cloudflare Dashboard > Storage & Databases > D1 > Create database

Name:

```text
nose-tea-onboarding
```

Copy the database ID into `wrangler.toml`.

## 2. Apply schema

Using Wrangler:

```bash
cd cloudflare-worker
wrangler d1 execute nose-tea-onboarding --file=./schema.sql --remote
```

## 3. Set secrets / vars

```bash
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_LOGIN_CHANNEL_ID
wrangler secret put ADMIN_EMAILS
```

Values:

- `LINE_CHANNEL_ACCESS_TOKEN`: Messaging API channel access token
- `LINE_LOGIN_CHANNEL_ID`: `2010372532`
- `ADMIN_EMAILS`: your admin email, for example `kaow@nosetea.com`

## 4. Deploy Worker

```bash
wrangler deploy
```

You will get a URL like:

```text
https://nose-tea-onboarding-api.YOUR_SUBDOMAIN.workers.dev
```

## 5. Connect frontend

Set `API_BASE` in `cloudflare-pages/index.html` to the Worker URL.
