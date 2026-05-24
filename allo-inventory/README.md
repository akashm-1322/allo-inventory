# Allo Inventory — Take-Home Exercise

A Next.js inventory reservation platform for multi-warehouse retail. Customers can hold units for 10 minutes during checkout, eliminating overselling without blocking abandoned carts.

## Live Demo

> Deploy URL goes here after deployment

## Local Development

### Prerequisites
- Node.js 18+
- A hosted Postgres instance (Supabase / Neon / Railway — all have free tiers)
- Redis instance (Upstash — free tier; optional but recommended)

### Setup

```bash
git clone <repo>
cd allo-inventory
npm install

# Copy env vars and fill them in
cp .env.example .env.local
```

Fill `.env.local` with your `DATABASE_URL` and `REDIS_URL`.

```bash
# Push schema to database
npx prisma db push

# Seed with sample data
npx prisma db seed

# Start dev server
npm run dev
```

Visit `http://localhost:3000`.

## How it works

### Concurrency — the core problem

Two customers can simultaneously click "Reserve" for the last unit of a SKU. The naive solution (read → check → write) has a race window: both see 1 unit available, both decrement, now `reserved = 2 > total = 1`.

**Solution: two-layer defence**

1. **Redis `SET NX EX` distributed lock** — before touching the database, we attempt to acquire a per-`(productId, warehouseId)` lock atomically. Only one request proceeds; the other gets a 409 immediately. This prevents wasted DB round-trips and is fast.

2. **`SELECT ... FOR UPDATE` inside a Postgres transaction** — even if Redis is unavailable (or two requests race before Redis acknowledges), the `FOR UPDATE` row lock means the second transaction blocks until the first commits. After the first commits, the second re-reads the updated `reservedUnits` and correctly detects insufficient stock.

This combination is correct under all conditions (Redis flap, network partition, process crash mid-transaction) because the DB transaction is the authoritative ground truth.

### Reservation expiry

Three mechanisms, layered:

**1. Vercel Cron (primary, in production)**  
`vercel.json` schedules `GET /api/cron/expire-reservations` every minute. The handler finds all `PENDING` reservations past `expiresAt`, atomically sets them to `EXPIRED`, and releases `reservedUnits` back to available stock. Protected by `CRON_SECRET`.

**2. Lazy cleanup on read (fallback)**  
When `GET /api/reservations/:id` or `POST /api/reservations/:id/confirm` runs, it checks `expiresAt` and expires the record if needed. This means even if the cron missed a window, the next interaction with the reservation handles it correctly.

**3. Frontend countdown**  
The UI shows a live countdown and re-fetches the reservation when the timer hits zero. The updated status is reflected without a page refresh.

### Idempotency (bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header. On first request, the key+response are stored in the `IdempotencyRecord` table. On retry with the same key, the stored response is returned without re-executing the side effect. This prevents double-charges and double-reservations from network retries.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router | Required |
| Language | TypeScript end-to-end | Required |
| ORM | Prisma | Clean migrations, type-safe queries |
| Database | Postgres (Supabase/Neon) | ACID transactions, row-level locking |
| Cache/Lock | Redis (Upstash) | Atomic `SET NX` for distributed locking |
| Validation | Zod | Shared schemas between API and forms |
| Styling | Inline styles (dark theme) | Intentional — no build step dependency |

## Trade-offs & what I'd do differently

**What's there:**
- Race-condition-free reservation with Redis + `SELECT FOR UPDATE`
- Full expiry (cron + lazy)
- Idempotency on reserve and confirm
- Live countdown UI with optimistic state updates
- Error surfaces (409, 410) shown to user

**Trade-offs made:**
- **No authentication** — reservations are anonymous. In production, tie reservations to user sessions/accounts to prevent abuse.
- **Simple lock TTL** — the Redis lock TTL is 15s; if a DB transaction takes longer, the lock releases early. Mitigated by the `FOR UPDATE` fallback.
- **Idempotency records never expire** — should add a cleanup job or Postgres TTL extension to purge records older than 24h.
- **No retry logic on the frontend** — a production checkout would retry transient network failures with the same idempotency key.
- **Inline styles over Tailwind** — faster to iterate; would use a proper design system (shadcn/ui) with more time.

**With more time:**
- Add user auth and tie reservations to accounts
- WebSockets / SSE for real-time stock updates across sessions
- Multi-item cart reservations (single atomic hold for a basket)
- Admin dashboard showing reservation metrics
- Proper test suite (unit tests for lock logic, integration tests for race conditions using concurrent requests)
