# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nose Tea LIFF Register** — a LINE onboarding platform for Nose Tea company. It is a static Cloudflare Pages site (no build step, no npm) that communicates entirely with a Cloudflare Worker backend.

Primary users access it through the LINE app via LIFF; HR/admin staff access it through a standard web browser using LINE OAuth2 login.

## Deployment

Deploy the `cloudflare-pages/` folder directly to Cloudflare Pages. No build step required — files are served as-is.

**Before first deploy**, replace `REPLACE_WITH_WORKER_SUBDOMAIN` in `index.html` with the actual Cloudflare Worker URL.

After deploy, set the LIFF Endpoint URL (in LINE Developers Console) to the Cloudflare Pages URL, e.g. `https://your-project.pages.dev/`.

Cache busting is handled by query params on asset URLs (e.g. `?v=20260616-03`) in `index.html` — bump these on every deploy that changes assets.

## Architecture

There is no framework, no transpiler, and no package manager. The entire frontend is:

| File | Purpose |
|---|---|
| `index.html` | Entry point; loads LIFF SDK from CDN, then `assets/app.js` and `assets/styles.css` |
| `assets/app.js` | ~1,850 lines of vanilla ES6 — all app logic |
| `assets/styles.css` | ~600 lines — full design system via CSS custom properties |
| `_headers` | Cloudflare Pages HTTP headers (no-store, nosniff) |

### Boot flow

```
boot()
  ├─ LINE browser → LIFF init → LINE login → getProfile → getPortal API
  │     ├─ Not registered → renderRegister()
  │     ├─ ?taskId param  → renderTaskForm()
  │     └─ Default        → renderPortal()  (mentee / mentor / HR tabs)
  └─ Web browser
        ├─ OAuth code+state in URL → completeWebLogin()
        ├─ Session token in localStorage → renderAdmin()
        └─ Default → renderWebFallback()
```

### Hardcoded config (top of app.js)

```js
const LIFF_ID = '2010372532-0i3JE94q';
const LINE_LOGIN_CHANNEL_ID = '2010372532';
const API_BASE = 'https://nose-tea-onboarding-api.hrtraining.workers.dev';
```

There is no `.env` — these constants live directly in source.

### API communication

All backend calls are `fetch` POST requests to `${API_BASE}/api` with a JSON body containing `{ action, idToken, webSessionToken, lineUserId, ... }`. The Worker determines the operation from the `action` field.

### State management

Global variables only — no store library:
- `lineProfile`, `idToken` — LIFF session
- `webSessionToken` — persisted in `localStorage` as `noseTeaWebSession`
- `currentUser`, `currentTasks`, `currentPortalMeta`, `adminCache` — portal data
- `portalTab`, `adminActiveTab` — navigation state

### User roles & portals

Three portal types rendered by the same `renderPortal()` / `renderAdmin()` entry points:
- **Mentee** — journey progress, tasks, library, profile
- **Mentor** — dashboard, mentee list, feedback/schedule tasks
- **HR / Admin** — full control center (Users, Groups, Sessions, Messages, Templates tabs)

### Text encoding repair

`app.js` contains ~200 lines dedicated to CP1252 → UTF-8 mojibake detection and repair, plus 135 hardcoded `KNOWN_TEXT_REPLACEMENTS` for Thai/English strings. This compensates for encoding issues in legacy backend data — do not remove.

## CSS design system

Colors are CSS custom properties: `--green-950/900/700/600/100`, `--cream`, `--paper`, `--line` (LINE brand green), `--ink`, `--muted`, `--orange`, `--red`, `--blue`. Typography is **Noto Sans Thai** loaded from Google Fonts. The UI renders inside a 420 px phone-frame mockup.

## Localization

All UI text is Thai. Dates use `toLocaleDateString('th-TH', ...)`. Do not introduce non-Thai UI strings without a Thai equivalent.
