# Deploying VChemics to Railway

The repo is deploy-ready: each service has a Dockerfile built from the repo root, the
backend applies migrations and seeds the CEO user on boot, and the frontend bakes its
public config at build time.

You'll create **two services** in your existing Railway project (PostgreSQL is already
provisioned): **backend** and **frontend**, both pointing at
`github.com/Srimunn/vechemics_dashboard`.

> Everything below happens in the Railway dashboard / your DNS provider — those are your
> account's actions. Nothing here needs code changes.

---

## 0. Generate secrets (once)

Run locally and keep these handy:

```bash
node -e "console.log('SYNC_AGENT_TOKEN=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

- `SYNC_AGENT_TOKEN` must be **identical** on the backend and the sync agent.
- `AUTH_SECRET` must be **identical** on the backend (`NEXTAUTH_SECRET`) and the frontend
  (`AUTH_SECRET` and `NEXTAUTH_SECRET`).

---

## 1. Backend service

1. **New → Deploy from GitHub repo** → pick `vechemics_dashboard`.
2. Service **Settings → Variables**, add:

   | Variable | Value |
   |---|---|
   | `RAILWAY_DOCKERFILE_PATH` | `Dockerfile.backend` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(reference your Postgres service; use its exact name)* |
   | `SYNC_AGENT_TOKEN` | *(from step 0)* |
   | `NEXTAUTH_SECRET` | *(the AUTH_SECRET from step 0)* |
   | `INITIAL_CEO_PASSWORD` | *(a strong password — this becomes the CEO login)* |
   | `COMPANY_NAME` | `VCHEMICS INDIA SOLUTIONS-2026-2027` |
   | `NODE_ENV` | `production` |

   (`PORT` is injected by Railway automatically — don't set it.)
3. **Settings → Networking → Generate Domain**. Note the URL, e.g.
   `https://vchemics-backend-production.up.railway.app`.
4. **Settings → Deploy → Healthcheck Path**: `/health`.
5. Deploy. When it's green, open `https://<backend-domain>/health` → you should see
   `{"status":"ok","db":"up"}`. On first boot the logs show
   `Seeded initial CEO user (ceo@vchemics.com)`.

---

## 2. Frontend service

1. In the **same project**: **New → Deploy from GitHub repo** → same repo.
2. Service **Settings → Variables**, add:

   | Variable | Value |
   |---|---|
   | `RAILWAY_DOCKERFILE_PATH` | `Dockerfile.frontend` |
   | `NEXT_PUBLIC_BACKEND_URL` | `https://<backend-domain>` *(from step 1.3)* |
   | `BACKEND_URL` | `https://<backend-domain>` *(same value; used server-side by NextAuth)* |
   | `NEXT_PUBLIC_USE_MOCK` | `false` |
   | `AUTH_SECRET` | *(same AUTH_SECRET as backend's NEXTAUTH_SECRET)* |
   | `NEXTAUTH_SECRET` | *(same value)* |
   | `NODE_ENV` | `production` |

   > `NEXT_PUBLIC_*` values are **baked into the browser bundle at build time**. If you
   > change either one later, you must **redeploy** the frontend for it to take effect.
3. **Settings → Networking → Generate Domain** (e.g.
   `https://vchemics-production.up.railway.app`).
4. Add one more variable now that you know the frontend URL:

   | Variable | Value |
   |---|---|
   | `AUTH_URL` | `https://<frontend-domain>` |
   | `NEXTAUTH_URL` | `https://<frontend-domain>` |

5. Redeploy the frontend.

---

## 3. Lock down CORS (recommended)

On the **backend** service add:

| Variable | Value |
|---|---|
| `CORS_ORIGIN` | `https://<frontend-domain>` |

Redeploy the backend. (Until you set this, the backend accepts any origin — fine for
first testing, better to restrict.)

---

## 4. First login

Open the frontend domain → you'll be redirected to `/login`.

- **Email:** `ceo@vchemics.com`
- **Password:** the `INITIAL_CEO_PASSWORD` you set on the backend.

The dashboard loads. It already shows the 10 days of seeded sample KPIs until the sync
agent starts sending real Tally data. To start clean instead, run once locally against
the Railway DB: `npm run -w @vchemics/backend db:seed:mock -- --clear`.

After the first successful login, remove `INITIAL_CEO_PASSWORD` from the backend
variables (the user already exists; it won't be re-seeded).

---

## 5. Point the sync agent at production

On the Vchemics PC, in `packages/sync-agent/.env`:

```
BACKEND_URL=https://<backend-domain>
SYNC_AGENT_TOKEN=<same token as the backend>
COMPANY_NAME=VCHEMICS INDIA SOLUTIONS-2026-2027
TALLY_URL=http://localhost:9000
```

Then `npm run sync:once` to push a full sync, or install the Windows service (see
`packages/sync-agent/install-service.md`).

---

## 6. Custom domain (optional — dashboard.vchemics.com)

1. Frontend service → **Settings → Networking → Custom Domain** → add
   `dashboard.vchemics.com`. Railway shows a CNAME target.
2. At your DNS provider, add a **CNAME** `dashboard` → that target.
3. Update the frontend `AUTH_URL` / `NEXTAUTH_URL` to `https://dashboard.vchemics.com`
   and the backend `CORS_ORIGIN` to the same, then redeploy both.
4. (Optional) give the backend a custom domain too, e.g. `api.vchemics.com`, and update
   the frontend's `NEXT_PUBLIC_BACKEND_URL` + `BACKEND_URL` to match (redeploy frontend).

---

## Troubleshooting

- **Build fails on Prisma / OpenSSL** — the backend image installs OpenSSL; confirm
  `RAILWAY_DOCKERFILE_PATH=Dockerfile.backend` is set (otherwise Railway uses Nixpacks
  and won't build the workspace correctly).
- **Dashboard shows "Couldn't reach the backend"** — `NEXT_PUBLIC_BACKEND_URL` is wrong
  or was changed without a redeploy, or `CORS_ORIGIN` doesn't include the frontend URL.
- **Login always fails** — backend and frontend `*_SECRET` values differ, or the CEO user
  wasn't seeded (check backend logs; ensure `INITIAL_CEO_PASSWORD` was set on first boot).
- **`invalid environment configuration` on backend boot** — a required variable
  (`DATABASE_URL`, `SYNC_AGENT_TOKEN`) is missing; the log lists which.
