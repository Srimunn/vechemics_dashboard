# Installing the VChemics Sync Agent as a Windows Service

The sync agent runs on the **Vchemics PC** (the one with TallyPrime). Installing it
as a Windows Service makes it start automatically on boot and keep running in the
background — no console window, survives reboots and logouts.

## 1. Prerequisites

- Node.js 20+ installed on the Vchemics PC.
- TallyPrime running with the HTTP-XML server enabled on `http://localhost:9000`
  (Gateway of Tally → F1: Help → Settings → Connectivity → Client/Server → set as
  **Both** or **Server**, port **9000**).
- This repo copied onto the PC (or at least the `sync-agent` package + `shared`).

## 2. Configure

```bash
cd packages/sync-agent
copy .env.example .env      # then edit .env
```

Set at minimum:

- `BACKEND_URL` — your deployed backend, e.g. `https://api.vchemics.com`
- `SYNC_AGENT_TOKEN` — must match the backend's `SYNC_AGENT_TOKEN`
- `COMPANY_NAME` — exact Tally company name
- `TALLY_URL` — usually `http://localhost:9000`

## 3. Build

```bash
# from the repo root (installs workspace deps and builds shared + agent)
npm install
npm run build --workspace @vchemics/shared
npm run build --workspace @vchemics/sync-agent
```

This produces `packages/sync-agent/dist/index.js`.

## 4. Test once before installing the service

```bash
cd packages/sync-agent
npm run sync:once
```

This runs a single full sync and exits. Check:
- `./samples/*.xml` — raw Tally responses were captured
- the backend logs / database — rows arrived

If the XML shape differs from the assumptions in the parsers, adjust the parser
modules in `src/sync-jobs/` and `src/parsers.ts` using the captured samples, then
rebuild.

## 5. Install as a service

`node-windows` is an optional dependency; install it, then run the installer:

```bash
npm install node-windows
npm run service:install
```

You'll get a UAC prompt (the service is registered under the Windows Service
Manager). Once installed it starts immediately and on every boot.

- Manage it in **services.msc** under **"VChemics Sync Agent"**.
- Logs are written by the service wrapper next to the script and via the app's
  pino logger.

## 6. Uninstall

```bash
npm run service:uninstall
```

## Manual / on-demand sync

Besides the schedule (every 15 min incremental, midnight full), a sync can be
triggered two ways:

1. **Dashboard button** — the frontend's "Refresh Tally Data" inserts a trigger
   row; the agent polls `GET /api/sync/pending-trigger` every
   `POLL_INTERVAL_SECONDS` and runs a sync when it finds one. No public tunnel to
   the PC required.
2. **Local endpoint** — `POST http://localhost:4001/trigger-sync` on the PC itself.
