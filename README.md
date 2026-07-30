# VChemics CEO Dashboard

A Tally-integrated executive dashboard for **VChemics India Solutions** (chemical
trading, Tamil Nadu). Surfaces the KPIs the CEO/MD cares about at a glance, sourced
live from **TallyPrime 7.0** via its HTTP-XML server.

> **Phase 1 scope:** Sync Agent + Backend API + Frontend with a fully functional CEO
> Dashboard page and placeholder ("Coming Soon — Phase 2") pages for the other 15
> modules. See the Phase 1 master prompt for the full spec.

## Monorepo layout

This is an **npm workspaces** monorepo (the master prompt allows pnpm _or_ npm; pnpm was
not installed on the build machine, so npm workspaces are used).

```
vchemics-dashboard/
├── packages/
│   ├── shared/       # shared TypeScript types (Voucher, Ledger, KPI shapes, ...)
│   ├── sync-agent/   # runs on the Vchemics PC as a Windows Service; reads Tally, pushes JSON
│   ├── backend/      # Express + Prisma + PostgreSQL; ingest + auth + dashboard APIs
│   └── frontend/     # Next.js 14 App Router dashboard
```

## Architecture

```
Vchemics PC (Win 11)                         Railway (cloud)
┌───────────────────────┐                    ┌──────────────────────────┐
│ TallyPrime :9000       │  XML req/resp      │ Backend API (Express)     │
│        ▲               │ ◀───────────────▶  │  /api/sync/ingest         │
│        │               │                    │  /api/auth/*              │
│  Sync Agent (Node svc) │ ── HTTPS POST ───▶ │  /api/dashboard/*         │
│  every 15 min + manual │                    │        │                  │
└───────────────────────┘                    │        ▼                  │
                                              │  PostgreSQL (Prisma)      │
                                              │  Frontend (Next.js 14)    │
                                              └──────────────────────────┘
                                                        │  HTTPS
                                                        ▼
                                                 CEO's browser
```

## Prerequisites

- Node.js >= 20 (built/tested on v22)
- npm >= 10
- PostgreSQL (local for dev, Railway-managed in prod)
- A reachable TallyPrime HTTP-XML server for the sync agent (`http://localhost:9000`)

## Getting started

```bash
npm install                 # installs all workspaces
npm run dev:backend         # Express API
npm run dev:frontend        # Next.js dashboard
npm run dev:sync-agent      # Tally sync agent (needs Tally running)
```

Copy each package's `.env.example` to `.env` and fill in values before running.

## Build order

Development follows the numbered **Build Order** in the Phase 1 master prompt, one step
at a time. Current status: **Step 1 (repo scaffolding) complete.**
