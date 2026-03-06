# Vistra DMS — Documents Management System

A simple Documents Management System that allows users to add and view documents and folders. Built with Next.js (frontend) and Express + MySQL (backend) as a monorepo managed with pnpm workspaces.

## Tech Stack

| Layer           | Technology                           |
| --------------- | ------------------------------------ |
| Frontend        | Next.js 16, React 19, Tailwind CSS 4 |
| Backend         | Node.js 20, Express 5, TypeScript    |
| Database        | MySQL 8 (via Prisma ORM)             |
| Package manager | pnpm 10                              |

## Prerequisites

- **Node.js 20** — install via [nvm](https://github.com/nvm-sh/nvm): `nvm install && nvm use`
- **pnpm 10** — `npm install -g pnpm`
- **Docker** — for running MySQL locally

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/asiapatrick/dms/
cd dms
```

### 2. Start MySQL

```bash
docker-compose up -d
```

This starts MySQL 8 on port **3307** with an empty-password root user and creates the `vistra_dms` database automatically.

### 3. Configure the API environment

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in the values (defaults work out of the box with the Docker setup above):

```env
DATABASE_URL="mysql://root:@localhost:3307/vistra_dms"
PORT=3000
JWT_SECRET="change-this-in-production"
CORS_ORIGIN=http://localhost:3001
```

> The web app environment (`apps/web/.env.local`) is already pre-configured for local development and does not need to be changed.

### 4. Install dependencies

From the repo root:

```bash
nvm use
pnpm install
```

### 5. Run database migrations

```bash
pnpm --filter api exec prisma migrate deploy
```

This applies all migrations (including the ngram FULLTEXT indexes used for server-side search) and seeds the demo user (`demo@vistra.local`) on first API startup.

### 6. Start the API

```bash
pnpm --filter api dev
```

API runs at **http://localhost:3000**. On startup it automatically seeds the demo user if not present.

### 7. Start the web app

In a separate terminal:

```bash
pnpm --filter web dev
```

Web app runs at **http://localhost:3001**. Open it in your browser — it signs in automatically with the demo user.

---

## Environment Variables

### `apps/api/.env`

| Variable       | Description             | Default (local)                           |
| -------------- | ----------------------- | ----------------------------------------- |
| `DATABASE_URL` | MySQL connection string | `mysql://root:@localhost:3307/vistra_dms` |
| `PORT`         | API listening port      | `3000`                                    |
| `JWT_SECRET`   | Secret for signing JWTs | _(must be set)_                           |
| `CORS_ORIGIN`  | Allowed frontend origin | `http://localhost:3001`                   |

### `apps/web/.env.local`

| Variable                   | Description         | Default (local)         |
| -------------------------- | ------------------- | ----------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API | `http://localhost:3000` |

---

## Running Tests

```bash
# All packages
pnpm -r test

# API only
pnpm --filter api test

# Web only
pnpm --filter web test
```

---

## Project Structure

```
vistra-dms/
├── apps/
│   ├── api/                  # Express REST API
│   │   ├── prisma/           # Schema, migrations
│   │   └── src/
│   │       ├── routes/       # auth, items, documents, folders
│   │       ├── middleware/   # JWT auth, error handler
│   │       ├── lib/          # Prisma client, logger, mappers, uid utils
│   │       └── types/        # Zod request schemas, internal types
│   └── web/                  # Next.js frontend
│       └── src/
│           ├── app/          # Next.js App Router pages
│           ├── components/   # DocumentsTable, modals, pagination
│           └── lib/          # API client, utils
└── packages/
    └── shared/               # Shared TypeScript DTOs (used by both apps)
```

---

## API Reference

All endpoints except `/auth/login` and `/health` require a `Bearer` token in the `Authorization` header.

| Method | Path          | Auth | Description                                                  |
| ------ | ------------- | ---- | ------------------------------------------------------------ |
| `POST` | `/auth/login` | No   | Get a demo JWT (24 h expiry)                                 |
| `GET`  | `/health`     | No   | Health check                                                 |
| `GET`  | `/items`      | Yes  | List folders and documents in a folder (paginated, sortable) |
| `POST` | `/folders`    | Yes  | Create a new folder                                          |
| `POST` | `/documents`  | Yes  | Add a document record (simulated upload)                     |

### GET /items — query parameters

| Parameter | Type             | Default  | Description                                                                                                                                                                                                                                                |
| --------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `folder`  | string (UID)     | _(root)_ | List contents of this folder                                                                                                                                                                                                                               |
| `page`    | number           | `1`      | Page number                                                                                                                                                                                                                                                |
| `limit`   | number           | `20`     | Items per page (max 100)                                                                                                                                                                                                                                   |
| `sortBy`  | `name` \| `date` | `name`   | Sort field                                                                                                                                                                                                                                                 |
| `sortDir` | `asc` \| `desc`  | `asc`    | Sort direction                                                                                                                                                                                                                                             |
| `search`  | string           | _(none)_ | Substring search across folder/file names. Uses a MySQL 8 ngram FULLTEXT index — filtering happens in the DB before pagination, so results span all pages. Minimum 2 characters (ngram token size); shorter values are ignored and all items are returned. |

---

## Design Decisions & Trade-offs

### Client-side rendering — no Next.js Server Components or React Query

The spec explicitly targets client-side rendering, and that was the right call for this application type.

Server Components shine for read-heavy, SEO-critical apps (CMS, marketing sites, public catalogues) where data can be fetched at request time on the server and sent as HTML. A document management system is the opposite: it is auth-gated, interaction-heavy, and personalised per user. There is no public content to index, and the folder-navigation UX requires immediate client-side state transitions that do not map naturally to server-rendered page segments.

React Query (TanStack Query) was considered and intentionally excluded for the same reason. Its primary value is cache management and background revalidation across multiple components. This app has a single data-owning page (`/documents`) with a controlled fetch lifecycle already managed by `useEffect` + `AbortController`. Adding React Query would introduce a caching layer with no cache to fill — each navigation to a new folder intentionally re-fetches fresh data. The fetch pattern here is already appropriate for the data-freshness requirements of a live file explorer.

### Authentication — mock login with a real JWT flow

The requirement states that login should not be required as a user-facing step. Rather than hardcoding a user identity in the API, the chosen approach is a mock `POST /auth/login` endpoint that issues a real, signed JWT (24 h expiry). The frontend calls it automatically on first load.

This keeps the entire auth middleware production-realistic: every protected route validates a Bearer token, resolves the user from the database, and attaches identity to the request. Upgrading to real credentials (password hash, OAuth, SSO) requires only changes inside `routes/auth.ts` — the middleware and all protected routes remain untouched, and the frontend API client requires no changes either because it already stores and sends the token as a standard Bearer header.

### File upload — simulated, no real storage

Per the spec, actual file storage is out of scope. The API generates a placeholder S3 key (`uploads/<ownerUid>/<timestamp>-<fileName>`) and persists the document metadata. The production path would be: client requests a presigned URL from the API → client uploads directly to S3 → client calls `POST /documents` with the confirmed metadata. The route contract (`fileName`, `mimeType`, `fileSizeBytes`, `folderUid`) does not change between the simulated and real implementations.
