# Cabinetto Pro

Modular cabinet catalog, customer ordering, and admin back-office built with **Next.js 16**, **PostgreSQL**, and **Tailwind CSS**.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- npm

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy the example file and edit values:

```bash
cp .env.example .env.local
```

Required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:password@localhost:5432/cabinet_project` |
| `AUTH_SECRET` | Session signing secret, **at least 32 characters**. Generate with: `openssl rand -base64 32` |

Optional:

| Variable | Description |
|----------|-------------|
| `QUICKBOOKS_ENABLED` | Set to `true` when QuickBooks OAuth is configured |
| QuickBooks OAuth vars | See `lib/quickbooks/config.ts` when enabling estimates |

### 3. Database setup

**Fresh database (schema + seed):**

```bash
psql -U postgres -d cabinet_project -f db/setup.sql
```

**Existing / incremental migrations** — run in this order on a database that already has the base catalog schema:

```bash
npm run db:auth
npm run db:profile
npm run db:approval
npm run db:tiers
npm run db:finishes
npm run db:finishes-active
npm run db:images-cart
npm run db:images-finish
npm run db:audit
npm run db:soft-delete-sku
npm run db:session-version
npm run db:quotes
npm run db:permissions
```

Default local connection (when `DATABASE_URL` is unset in migration scripts):

`postgresql://postgres:5454@localhost:5432/cabinet_project`

After `db:auth`, a seed admin is available (see `db/auth-seed.sql`).

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

## Project structure

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages and API routes |
| `components/` | UI and feature components |
| `lib/` | Server utilities, auth, catalog, orders |
| `db/` | SQL schema, migrations, seeds |
| `scripts/` | Node migration runners |
| `proxy.ts` | Request proxy (auth gates, rate limits, security headers) |

## Authentication

- Sessions are stored in an httpOnly cookie (`cabinet_session`), signed with JWT (HS256).
- Session lifetime: **14 days**.
- Sessions are invalidated when password/email changes, account status or role changes, admin permissions change, or `session_version` is bumped in the database.
- After running `db:session-version`, users may need to sign in again.

## Admin permissions

Granular RBAC is enforced in API routes (`can_view_products`, `can_toggle_products`, etc.). The root `proxy.ts` performs a coarse admin role check on `/admin` and `/api/admin`; fine-grained checks happen per route.

## Brand typography

Typography uses [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) via `next/font` for UI copy and the Cabinetto Pro wordmark (see `app/layout.tsx` and `lib/ui-classes.ts`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:*` | Database migrations (see `package.json`) |

## Security notes

- Content-Security-Policy and HSTS are set in `next.config.ts` (production).
- Rate limits on login, register, credential updates, and cart validation are in `proxy.ts`.
- Product images must be uploaded via `/api/admin/upload` or use allowed remote hosts (`images.unsplash.com`).

## License

Private project.
