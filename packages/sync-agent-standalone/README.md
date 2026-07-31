# VChemics Sync Agent (Standalone)

A **self-contained** program that reads data from TallyPrime on this PC and pushes it to
the VChemics dashboard backend. No monorepo, no TypeScript build — copy this folder to
the Vchemics PC, run `npm install`, and go.

## What it does

Reads these Tally reports and sends them to the backend:

- **Balance Sheet**, **Profit & Loss**, **Trial Balance**
- **Stock Summary**
- **Day Book** and **Voucher Register** for Sales / Purchase / Receipt / Payment

## Requirements

- **Node.js 18+** on the Vchemics PC — download from <https://nodejs.org> (LTS).
- **TallyPrime** open, with the VChemics company loaded, and the HTTP-XML server
  enabled: *Gateway of Tally → F1 (Help) → Settings → Connectivity → Client/Server
  configuration →* set as **Both** (or **Server**), port **9000**.

## Setup (on the Vchemics PC)

1. Copy this whole `sync-agent-standalone` folder onto the PC (USB is fine).
2. Open a terminal (PowerShell) in the folder.
3. Install dependencies:

   ```
   npm install
   ```

4. Create your settings file:

   ```
   copy .env.example .env
   ```

   Edit `.env` and set:
   - `BACKEND_URL` — the deployed backend, e.g. `https://vchemics-backend-production.up.railway.app`
   - `SYNC_AGENT_TOKEN` — **exactly** the same token configured on the backend
   - `COMPANY_NAME` — leave as `VCHEMICS INDIA SOLUTIONS-2026-2027` unless it differs
   - `TALLY_URL` — usually `http://localhost:9000`

## Step 1 — Test the Tally connection

```
npm run test:tally
```

This checks connectivity and saves a raw XML sample of every report into `./samples`.
It does **not** send anything to the backend. You should see a byte count and a parsed
record count for each report. If a report parses 0 records unexpectedly, open its file in
`./samples` and share it — the parser can be adjusted.

## Step 2 — Run a full sync

```
npm run sync
```

Reads every report, parses it, and pushes to `BACKEND_URL/api/sync/ingest` (with the
`X-Sync-Token` header). Prints how many records each report pushed and records a
"last sync" entry the dashboard shows.

## Keep it running automatically (optional)

Use **Windows Task Scheduler** to run `npm run sync` on a schedule:

1. Open *Task Scheduler → Create Basic Task*.
2. Trigger: **Daily**, then on the next screen tick *Repeat task every 15 minutes* for
   a duration of *1 day* (Indefinitely).
3. Action: *Start a program*.
   - Program/script: `npm`
   - Add arguments: `run sync`
   - Start in: the full path to this folder (e.g. `C:\vchemics\sync-agent-standalone`).
4. Finish. (Tick "Run whether user is logged on or not" if you want it headless.)

TallyPrime must be running for a sync to succeed.

## Files

```
sync-agent-standalone/
├── package.json         only 4 deps: axios, fast-xml-parser, dotenv, pino
├── .env.example         copy to .env and fill in
├── test-tally.js        connection test + saves raw XML samples
├── sync-once.js         one full sync -> pushes to the backend
├── lib/
│   ├── config.js        reads .env
│   ├── logger.js
│   ├── tally-client.js  POST XML to Tally, sanitize + parse, save samples
│   ├── xml-templates.js Tally request XML (Export Data + SVCURRENTCOMPANY)
│   ├── parsers.js       parses the confirmed Tally XML formats
│   ├── reports.js       the list of reports to sync
│   └── uploader.js      pushes to the backend (batched, retries)
└── samples/             raw XML captured at runtime
```

## Troubleshooting

- **"Tally request failed"** — TallyPrime isn't running, the company isn't loaded, or the
  XML server/port is off. Confirm by opening `http://localhost:9000` in a browser on the
  PC (it should say *TallyPrime Server is Running*).
- **Backend rejects with 401** — `SYNC_AGENT_TOKEN` doesn't match the backend's.
- **A report pushes 0 records** — check its saved file in `./samples`; the Tally XML for
  that report may differ. Trial Balance in particular is best-effort until its exact
  format is confirmed from a sample.
