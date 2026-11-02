# Stellar SnapClaim

**Snap the bill. Clear the claim.** Employee expense claims for Stellar Infomatica: instant receipt capture to verified reimbursement in minutes, not weeks.

- **Snap & Extract** – photograph a receipt; Claude reads vendor, date, total, tax, line items and suggests a category. Runs on the server with the company key, so employees never need one. Without a key the form is simply filled by hand.
- **Auto-Verification** – every claim is checked live against the company spending policy (per-claim and per-month caps, receipt-required threshold, submission window, duplicates). Blocking flags stop submission; warnings travel with the claim so the manager sees why.
- **One-Tap Manager Approval** – managers see their team's queue on phone or web and approve or reject in batches.
- **Month-end review** – directors get the month's roll-up by employee and category, a flagged-claims list, an Excel workbook with a sign-off column, and a Close month action that clears approved claims.

Direct payout / payroll sync is deliberately **not** built yet.

## Layout

```
api/     .NET 9 minimal API (Dapper + Npgsql), Dockerfile, dev.sh dev loop, smoke.mjs
db/      sql/ migrations applied at API start, seed/ dev company + policy
app/     Expo SDK 58 app (expo-router) for Android, iPhone and web
         src/motion/ is the motion layer: each piece has a .web.tsx (GSAP + CSS transitions)
         and a native file (Reanimated); screens import the name and Metro picks the platform
         src/constants/theme.ts is the one light world: cream ground, beige surfaces, plum
         accent, Instrument Serif for display (loaded at startup), tracked caps for labels
deploy/  docker-compose (db + api + static web), .env.example, Caddyfile.example
```

## Roles

| Role | Can |
| --- | --- |
| employee | file claims, withdraw one before it is decided; no edits after submission |
| approver | + approve, reject and edit submitted claims of their direct reports |
| admin | + see every claim in the company, month-end review, Excel, close month, audit trail |
| super_admin | + decide on anyone's claim, people and reporting lines (onboard/offboard), categories, policy |

## Run locally (no .NET SDK needed, Docker only)

```bash
api/dev.sh up        # postgres + sdk containers
api/dev.sh restart   # build + start the API on http://localhost:8097 (seeds a dev company)
api/dev.sh smoke     # end-to-end check: employee → manager → director
```

Dev sign-ins (seeded when `SNAPCLAIM_SEED_DEV=true`): `admin@snapclaim.local / ChangeMe123!` (super admin), `director@snapclaim.local / Director123!` (admin), `manager@snapclaim.local / Manager123!` (approver), `ravi@snapclaim.local` and `anita@snapclaim.local / Employee123!`.

To enable Snap & Extract locally put `ANTHROPIC_API_KEY=sk-ant-...` in `api/.env.dev` (gitignored) and restart.

App:

```bash
cd app && npm install
npm run web          # http://localhost:8081, talks to the API at :8097 by default
npm run typecheck && npm run lint
```

Set `EXPO_PUBLIC_API_URL` to point the app elsewhere.

Phones need a development build (camera, secure store). The project is linked to EAS as `@jaskiratoberoi/snapclaim`; `npm run eas:dev` builds an installable Android APK in the cloud. Install it, run `npm start` on the PC, and open the project from the dev launcher. Without `EXPO_PUBLIC_API_URL` the phone talks to the API on the machine running Metro (port 8097), so start the API first and keep the phone on the same network. If Metro advertises the wrong adapter (VPN, WSL, Hyper-V), run `npx expo start --host lan` with `REACT_NATIVE_PACKAGER_HOSTNAME=<your LAN IP>`.

## Deploy

```bash
cp deploy/.env.example deploy/.env   # fill in
docker compose -f deploy/docker-compose.yml up -d --build
```

The API listens on `127.0.0.1:${SNAPCLAIM_API_PORT}` and the static web build on `127.0.0.1:${SNAPCLAIM_WEB_PORT}`. The web container's nginx proxies `/api` and `/health` to the API, so one hostname serves both and `SNAPCLAIM_PUBLIC_API_URL` is simply the site's own origin. Put Caddy or a Cloudflare tunnel in front of the web port. Migrations run at API start; the first start creates the company and the admin from `SNAPCLAIM_BOOTSTRAP_*`.

Production on this server: **https://expense.genomicslab.in** — compose project `snapclaim`, web on `127.0.0.1:3181`, API on `127.0.0.1:3180` (3170/3171 belong to another app), published through the `telo` cloudflared tunnel (`~/.cloudflared/config.yml`; a new hostname needs an elevated restart of the Cloudflared service). Secrets live in `deploy/.env` on the server only. Redeploy after a pull with the same `docker compose ... up -d --build`.

## API sketch

All under `/api/v1`, JSON snake_case, bearer JWT (access 30 min, refresh rotated).

- `auth/login|refresh|logout|logout-all|me|change-password`
- `categories`, `policy`, `policy/check`
- `receipts` (multipart `file`) · `receipts/base64` · `receipts/{id}` · `receipts/{id}/image` · `receipts/{id}/extract`
- `claims?scope=mine|team|all&status=&period=` · `claims/{id}` · `claims/{id}/submit|withdraw`
- `approvals` · `approvals/decide`
- `months` · `months/{period}` · `months/{period}/export.xlsx` · `months/{period}/close`
- `users` · `admin/users` · `admin/categories` · `admin/policy`
