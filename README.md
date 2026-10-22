# FinGraph: Graph-Based Money Laundering Ring Detection System

FinGraph is an Anti-Money Laundering (AML) intelligence and surveillance platform designed to identify high-risk financial cycles, structuring / smurfing schemes, and money laundering rings.

This repository represents **Sprint 1: UI Foundation and PostgreSQL Database Layer**.

---

## Architecture Overview

```
fingraph/
├── database/
│   ├── schema.sql           # PostgreSQL DDL: tables, constraints, indexes & triggers
│   ├── seed.sql             # Deterministic synthetic seed data for classroom demos (500 tx)
│   └── verify.sql           # Verification test suite checking counts, constraints & scenarios
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── health/      # Health check endpoint (GET /api/health)
│   │   │       └── route.ts
│   │   ├── alerts/          # Alerts page (Sprint 2 placeholder)
│   │   ├── detection-rules/ # Rules page (Sprint 3 placeholder)
│   │   ├── graph-analysis/  # Graph analysis page (Sprint 3 placeholder)
│   │   ├── transactions/    # Transactions page (Sprint 2 placeholder)
│   │   ├── layout.tsx       # Root layout shell with Sidebar and Header
│   │   ├── page.tsx         # Dashboard landing page with overview cards
│   │   └── globals.css      # Dark theme design system
│   ├── components/
│   │   ├── layout/          # Responsive Sidebar, Header, and navigation shell
│   │   └── ui/              # Reusable Card, Badge, and Button primitives
│   ├── lib/
│   │   ├── db.ts            # Server-only PostgreSQL connection pool (pg)
│   │   ├── env.ts           # Zod schema validation for environment variables
│   │   └── queries/         # Parameterized server queries (transactions, alerts, rules, stats)
│   └── types/               # TypeScript interfaces matching database entities
├── .env.example             # Template environment variables
└── README.md
```

---

## 1. Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended)
- **npm**: `v10.x` or later
- **PostgreSQL**: `v14` or later (supports `gen_random_uuid()` and JSONB indexing)

---

## 2. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` to configure your PostgreSQL connection string:

```env
# PostgreSQL connection string
# Format: postgresql://[user]:[password]@[host]:[port]/[database]
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fingraph_db"

# Node Environment
NODE_ENV="development"
```

> **Security Note:** `.env.local` and all secret files are strictly ignored by `.gitignore`. Database credentials are bound exclusively to the server via `import 'server-only'` in `src/lib/db.ts` and will never leak into client-side bundles.

---

## 3. Database Creation & Schema Execution

### Step 3.1: Create the Database

Using `psql` or PostgreSQL CLI:

```bash
psql -U postgres -c "CREATE DATABASE fingraph_db;"
```

### Step 3.2: Apply Schema DDL

Run `database/schema.sql` to generate all tables, constraints, and indexes:

```bash
psql "$DATABASE_URL" -f database/schema.sql
```

The schema defines 5 core tables:
1. `customers`: Master records with unique email constraints.
2. `accounts`: Customer accounts with status constraints and default currency `INR`.
3. `transactions`: Fund movement ledger with positive-amount constraints (`amount > 0`), account distinctness constraints, and status check.
4. `alerts`: Suspicious activity logs with risk scores (`0-100`), severity rankings, and `evidence` JSONB payloads.
5. `detection_rules`: Rule configurations and parameter thresholds stored as JSONB.

### Step 3.3: Load Synthetic Seed Data (Sprint 2 Dataset)

Run `database/seed.sql` to populate deterministic, fictional data:

```bash
psql "$DATABASE_URL" -f database/seed.sql
```

The seed script is strictly idempotent (`ON CONFLICT (id) DO NOTHING`), safely re-runnable, and populates:
- **50 Customers**: Mix of individual and corporate entities.
- **60 Accounts**: Distributed across customers with active, under-review, dormant, and frozen statuses.
- **7 Detection Rules**: Realistic AML patterns (circular flows, structuring, velocity, dormant spikes, layering chains, shared mules, split transfers).
- **500 Transactions**: Comprehensive mix of ordinary commercial payments and predetermined AML scenarios.
- **25 Alerts**: Demonstration alerts with structured JSONB graph evidence and risk scores.

### Step 3.4: Verify Database Layer Integrity

Run the verification test suite to check row counts, orphan references, constraints, and scenario detection:

```bash
psql "$DATABASE_URL" -f database/verify.sql
```

> **Synthetic Notice:** All accounts, entities, and transactions in `database/seed.sql` are strictly fictional and constructed for classroom demonstration.

---

## 4. Development Commands

Install dependencies (if not already installed):
```bash
npm install
```

Start the local development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

Run the production build:
```bash
npm run build
```

Run TypeScript compilation check:
```bash
npx tsc --noEmit
```

Run ESLint:
```bash
npm run lint
```

---

## 5. Health Check Endpoint

FinGraph provides a server-side health probe at `GET /api/health`.

### Expected Responses

#### When PostgreSQL is connected:
**HTTP 200 OK**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-22T12:00:00.000Z",
  "service": "fingraph-api",
  "version": "0.1.0",
  "database": {
    "connected": true,
    "responseTimeMs": 4
  }
}
```

#### When PostgreSQL is disconnected or unreachable:
**HTTP 503 Service Unavailable**
```json
{
  "status": "degraded",
  "timestamp": "2026-10-22T12:00:00.000Z",
  "service": "fingraph-api",
  "version": "0.1.0",
  "database": {
    "connected": false,
    "responseTimeMs": 15,
    "error": "PostgreSQL connection failed or database unreachable"
  }
}
```

> **Safety Assurance:** The health check endpoint never exposes connection strings, internal database credentials, or database engine stack traces to clients.

---

## 6. Implementation Boundaries & Next Sprints

- **Sprint 1 (Current):** Next.js App Router UI Shell, responsive sidebar/header, PostgreSQL schema, database pool connection, parameterized server queries, and health check API.
- **Sprint 2:** Interactive TanStack Table (`@tanstack/react-table`) for transaction exploration and alert triage.
- **Sprint 3:** Neo4j graph engine integration, circular flow cycle detection algorithms, and interactive graph canvas.
