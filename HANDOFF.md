# Beauty Booking — Master Reference & Handoff

Mobile-first booking app for **Ashley Lacy Esthetics**, built as part of the Muze Office amenity ecosystem. Live card payments via Square, booking records in Neon Postgres, admin auth via magic-link.

**Last updated:** 2026-07-01

---

## Current state

| Area | Status |
|---|---|
| Square payments (deposit + full charge) | ✅ Working E2E |
| Square Payment Link balance collection | ✅ Working E2E |
| Square webhook handler (HMAC-verified) | ✅ Wired — handles payment + refund + dispute |
| Refund-on-cancel (admin) | ✅ Atomic refund + status flip, idempotent |
| Refund state via webhook | ✅ Pending→Completed/Failed transitions + external-refund recovery |
| Neon Postgres schema + CRUD | ✅ Live (6 migrations) |
| Customer portal (lookup / reschedule / cancel) | ✅ DB-backed |
| Admin dashboard (list / confirm / cancel / collect-balance) | ✅ DB-backed + audit trail |
| Admin auth (NextAuth v5 + magic-link) | ✅ Email allowlist, JWT sessions |
| Service catalog | ✅ DB-backed, editable at `/admin/services` |
| 24h appointment reminders | ✅ Vercel cron, daily 16:00 UTC |
| Booking event audit trail | ✅ Append-only `booking_events` table |
| Vercel deployment | ✅ Linked to `mrokais-projects/beauty-booking` |
| Custom domain | ⏳ Not configured — using `*.vercel.app` |
| Square production webhook subscription | ⚠️ Verify against current canonical URL |

---

## Tech stack

- **Next.js 16.2.6** (App Router, Turbopack) + **React 19.2.4**
- **Drizzle ORM** + **postgres.js** → **Neon Postgres**
- **Square Node SDK v44** (server — payments, payment links, refunds, webhooks)
- **Square Web Payments SDK** (browser — card tokenization)
- **NextAuth v5 (beta.31)** + `@auth/drizzle-adapter` + Nodemailer magic-link
- Vanilla CSS (~1700 lines in `app/globals.css`, no Tailwind runtime despite Tailwind in devDeps)
- JavaScript, not TypeScript (TS installed as devDep, app code is `.js`)

---

## Where things live

- **Local:** `~/Desktop/Ashley Lacy/beauty-booking`
- **GitHub:** https://github.com/m-rokai/beautybook (branch `main`)
- **Vercel project:** `mrokais-projects/beauty-booking` (project id `prj_ca3aYYofDsygY6IGAt838BSZguUL`)
- **Vercel default URL:** https://beauty-booking-three.vercel.app
- **Neon:** Connection strings in `.env.local`. Hosted in `us-east-1`, endpoint `ep-dry-fog-amk6sdpn`.
- **Square:** **Production** environment. Configured per `SQUARE_ENVIRONMENT=production`.

> Note: there are also stale Vercel projects `beautybook` and `beautybook-za5x` in the team. The repo is linked to `beauty-booking`. Consider deleting the other two to avoid confusion.

---

## Running locally

```bash
cd ~/Desktop/Ashley\ Lacy/beauty-booking
npm run dev      # → http://localhost:3100
```

**Dev server runs on port 3100**, not 3000 — `package.json` → `"dev": "next dev -p 3100"`.

---

## Environment variables

All secrets live in `.env.local` locally and Vercel project settings in production.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection (runtime) |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (migrations) |
| `SQUARE_ENVIRONMENT` | `sandbox` or `production` |
| `SQUARE_ACCESS_TOKEN` | Square server API token |
| `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | Browser Web Payments SDK |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Browser Web Payments SDK |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | HMAC verification on `/api/webhooks/square` |
| `NEXT_PUBLIC_APP_URL` | Used by webhook handler for `notificationUrl` and email links — must match the URL Square posts to |
| `AUTH_SECRET` | NextAuth JWT signing |
| `AUTH_ALLOWED_ADMIN_EMAILS` | Comma-separated emails or `@domain.com` suffixes |
| `EMAIL_SERVER_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `EMAIL_FROM` | SMTP (Gmail) for magic-link + customer notifications |
| `CRON_SECRET` | Authorizes `/api/cron/reminders` (set by Vercel cron) |

Sync local from prod with `vercel env pull .env.local` if needed.

---

## Data model

**Three tables** (plus Auth.js tables `user`, `account`, `session`, `verificationToken`):

### `bookings` (27 columns)
- `code` — unique `AL-XXXXX` reference shown to customers
- `serviceId` (legacy single-service) + `serviceIds` (text[], multi-service)
- `serviceName`, `addOnNames` (text[])
- `scheduledDate`, `scheduledTimeId`, `scheduledTimeLabel`
- `customerName`, `customerEmail`, `customerPhone`, `customerNotes`
- `status` — `confirmed | pending | cancelled | rescheduled | completed`
- `paymentIntent` — `deposit | full`
- `totalCents`, `depositCents`, `remainingCents` (all money in cents)
- `balanceStatus` — `paid | unpaid | link_sent`
- `depositSquarePaymentId`, `depositSquareStatus`, `depositSquareReceiptUrl`
- `balanceLinkId`, `balanceLinkUrl`, `balanceOrderId`, `balanceSquarePaymentId`
- `refundStatus` — `null | pending | completed | failed`
- `refundCents`, `refundedAt`, `refundDepositSquareId`, `refundBalanceSquareId`, `refundError`
- `reminderSentAt`
- `createdAt`, `updatedAt`

### `booking_events` (audit trail)
- Append-only log of every material mutation (created, status_changed, services_edited, balance_link_sent, balance_paid, refund_completed, refund_failed, reminder_sent, confirmation_sent, update_notified, cancelled).
- Columns: `bookingId`, `bookingCode`, `eventType`, `summary`, `payload` (jsonb), `actor` (`admin:<email>` | `customer` | `system` | `webhook`), `createdAt`.

### `services` (editable catalog)
- 35 rows seeded by migration `0004` (facials, waxing, massage, lash, etc.)
- `id`, `name`, `description`, `categoryId` (`skin-care | waxing | self-care`)
- `durationMinutes`, `priceCents`, `depositCents` (override), `cancellationCents` (override)
- `isActive`, `sortOrder`

Schema: `lib/db/schema.js`. Auth schema: `lib/db/auth-schema.js`. Migrations: `drizzle/0000_*.sql` through `drizzle/0005_*.sql`.

---

## Architecture highlights

### 1. Atomic payment + booking insert
`POST /api/payments` charges Square and inserts the booking in one request. Server generates the booking code. If Square fails → no booking. If Square succeeds but DB fails → payment ID surfaced in error response for manual reconciliation.

### 2. Balance collection flow
1. Admin clicks **Send payment link** in `/admin`
2. Frontend calls `POST /api/bookings/collect-balance` with `{ bookingCode }`
3. Server creates Square Payment Link with the remaining amount
4. `balanceLinkUrl` persisted, `balanceStatus` → `link_sent`
5. Admin shares link with customer
6. Customer pays at `square.link/u/...`
7. Square fires `payment.updated` webhook → handler matches via `orderId` / `referenceId` / `note` → `balanceStatus` → `paid`

### 3. Admin cancel + refund flow
`POST /api/bookings/:code/cancel` with `{ refund: 'deposit' | 'full' | 'none' }`:
1. Reject if already cancelled (idempotent guard)
2. Call `client.refunds.refundPayment` for each charge
3. Write `refundStatus` (`pending`/`completed`), `refundCents`, refund Square IDs, `status='cancelled'`
4. Send cancellation email + log audit event
5. If Square returns PENDING, the webhook flips to COMPLETED later

### 4. Refund webhook
`refund.created` / `refund.updated` events:
1. Match booking by `refund.id` (against `refundDepositSquareId` / `refundBalanceSquareId`)
2. Fallback to `refund.payment_id` (covers refunds initiated externally from Square dashboard)
3. Map status: `COMPLETED → completed`, `PENDING → pending`, `FAILED|REJECTED → failed`
4. External refunds (no prior admin cancel) also flip `status` → `cancelled`
5. Idempotent — does not downgrade `completed` or rewrite identical state

### 5. Magic-link admin auth
- NextAuth v5 + Drizzle adapter + Nodemailer (Gmail SMTP)
- `signIn` callback enforces `AUTH_ALLOWED_ADMIN_EMAILS` (exact email or `@domain.com` suffix)
- `isAdmin` flag computed in JWT callback, checked in `authorized()` for `/admin/*`
- JWT sessions (not session table), 30-day lifetime

### 6. Reminder cron
`/api/cron/reminders` runs daily at 16:00 UTC (`vercel.json`). Finds confirmed bookings 24h out without `reminderSentAt`, emails them, writes `reminderSentAt` + audit event. Authorized via `CRON_SECRET`.

### 7. Client/server boundary in `lib/`
- `lib/db/*` + `lib/bookings-db.js` + `lib/square.js` + `lib/services-db.js` + `lib/booking-events.js` + `lib/mailer.js` + `lib/auth-helpers.js` → **server-only** (never import from client components)
- `lib/booking-store.js` → **client-safe** thin fetch wrappers + pure date helpers
- `lib/demo-data.js` → **shared**, pure data (categories + add-ons only; services live in DB)

---

## API surface

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/payments` | POST | public | Atomic Square charge + booking insert |
| `/api/bookings` | GET | admin | List all bookings |
| `/api/bookings/[code]` | GET | public | Find by code (portal + admin) |
| `/api/bookings/[code]` | PATCH | public¹ | Update status/reschedule — whitelisted fields |
| `/api/bookings/[code]/cancel` | POST | admin | Atomic refund + cancel |
| `/api/bookings/[code]/events` | GET | admin | Audit log |
| `/api/bookings/[code]/services` | GET/PATCH | admin | Edit services on existing booking |
| `/api/bookings/availability` | GET | public | Taken slots for `?date=YYYY-MM-DD` |
| `/api/bookings/collect-balance` | POST | admin | Create Square Payment Link |
| `/api/admin/services` | GET/POST | admin | Service catalog list + create |
| `/api/admin/services/[id]` | PATCH | admin | Edit service |
| `/api/auth/[...nextauth]` | * | NextAuth | Magic-link sign-in handlers |
| `/api/webhooks/square` | POST | HMAC | Payment + refund + dispute events |
| `/api/cron/reminders` | GET | CRON_SECRET | 24h reminder cron |
| `/api/platform-status` | GET | public | Env readiness check |
| `/api/qr` | GET | public | QR code generator |

¹ Customer portal uses code as bearer — anyone with a booking code can read/update that booking. Acceptable for MVP; revisit if abuse appears.

---

## Key files

```
lib/
├── db/
│   ├── index.js               # Drizzle client (cached across HMR)
│   ├── schema.js              # bookings + booking_events + services
│   └── auth-schema.js         # Auth.js tables
├── bookings-db.js             # Server-only queries (incl. findBookingByPaymentId/RefundId)
├── services-db.js             # Service catalog CRUD
├── booking-store.js           # Client-side fetch wrappers + date helpers
├── booking-events.js          # Audit log writer
├── square.js                  # SquareClient factory + BigInt-safe JSON serializer
├── mailer.js                  # Nodemailer + branded templates
├── auth-helpers.js            # getSession()
├── demo-data.js               # Categories + add-ons (services moved to DB)
└── platform.js                # Env readiness check

app/
├── api/
│   ├── admin/services/        # Service catalog CRUD
│   ├── auth/[...nextauth]/    # Auth.js handlers
│   ├── bookings/
│   │   ├── route.js                  # GET list (admin)
│   │   ├── [code]/route.js           # GET + PATCH
│   │   ├── [code]/cancel/route.js    # Atomic refund + cancel
│   │   ├── [code]/events/route.js
│   │   ├── [code]/services/route.js
│   │   ├── availability/route.js
│   │   └── collect-balance/route.js
│   ├── cron/reminders/route.js
│   ├── payments/route.js
│   ├── webhooks/square/route.js      # HMAC + payment + refund + dispute handler
│   ├── platform-status/route.js
│   └── qr/route.js
├── admin/
│   ├── page.js                       # Dashboard (auth-gated)
│   ├── login/page.js + verify/
│   └── services/page.js
├── booking/page.js
├── portal/page.js
├── page.js                           # Marketing home + Instagram embed
├── layout.js
└── globals.css                       # ~1700 lines of hand-rolled CSS

components/
├── booking/BookingExperience.js      # Multi-step wizard + Square Web Payments SDK
├── admin/AdminDashboard.js           # Appointments + collect-balance + cancel + audit log
├── admin/ServiceEditor.js
├── portal/CustomerPortal.js
└── SiteHeader.js

drizzle/
├── 0000_icy_shaman.sql               # Initial bookings table
├── 0001_auth_tables.sql              # Auth.js tables
├── 0002_add_refund_fields.sql
├── 0003_add_service_ids.sql          # Multi-service
├── 0004_add_services_table.sql       # 35-row service catalog seed
├── 0005_add_booking_events_and_reminder.sql
└── meta/
drizzle.config.js
auth.js                                # NextAuth v5 config
vercel.json                            # Reminder cron schedule
```

---

## Known gotchas (read these before debugging anything)

1. **Dev port is 3100**, not 3000.
2. **Square sandbox rejects `@example.com` emails** — RFC-reserved. `collect-balance` auto-falls back to no `prePopulatedData` on email errors. Real emails work fine.
3. **Square Web Payments SDK has TWO CDNs.** Sandbox app IDs (`sandbox-*`) → `sandbox.web.squarecdn.com`. Production → `web.squarecdn.com`. Detected in `BookingExperience.js`.
4. **Square SDK v44 API shapes:**
   - `client.payments.create({ sourceId, idempotencyKey, amountMoney: { amount: BigInt(cents), currency: 'USD' }, locationId, referenceId, note, buyerEmailAddress })`
   - `client.checkout.paymentLinks.create({ idempotencyKey, description, quickPay: { name, priceMoney, locationId }, paymentNote, prePopulatedData })`
   - `client.refunds.refundPayment({ idempotencyKey, paymentId, amountMoney, reason })`
   - `WebhooksHelper.verifySignature({ requestBody, signatureHeader, signatureKey, notificationUrl })`
   - **Money amounts are `BigInt`**. Use `BigInt(cents)` and `serializeSquare()` from `lib/square.js` before returning JSON.
5. **Webhook signature uses `NEXT_PUBLIC_APP_URL`** — if this drifts from the URL Square actually posts to, signature verification fails. Re-check after switching custom domains.
6. **Drizzle Kit `push` is interactive.** Use `drizzle-kit generate` + the migrator snippet below for non-TTY.
7. **Neon free tier is 10 projects.** Reset DB password from Neon console → Settings if creds leak.
8. **Three Vercel projects exist** (`beauty-booking`, `beautybook`, `beautybook-za5x`). Repo is linked to `beauty-booking`; the other two were disconnected from GitHub on 2026-07-01 (kept, per owner preference) so pushes build only the real project. Don't reconnect them.
9. **The Square card form must attach only while the Pay step is rendered.** Wizard steps are conditionally rendered, so `#al-card-container` doesn't exist until `currentStep === 4`. Attaching at mount throws `ElementNotFoundError` and permanently disables the Pay button (this shipped broken with the wizard refactor and was fixed 2026-07-01). The attach effect in `BookingExperience.js` is keyed on `currentStep` — keep it that way.
10. **Vercel env vars on this project are Sensitive** — `vercel env pull` redacts them to empty strings. An empty value in a pulled file does NOT mean the variable is empty in production. To check webhook URL config at runtime: an unsigned POST to `/api/webhooks/square` returns 401 (configured) vs 400 (missing config).
11. **Webhook `notificationUrl` falls back to the canonical URL** via `lib/site.js` `SITE_URL` when `NEXT_PUBLIC_APP_URL` is unset — update `lib/site.js` if the domain ever changes.

---

## Test credentials

**Sandbox browser card form:**
- Card: `4111 1111 1111 1111` · Exp: any future date · CVV: `111` · ZIP: `94103`

**Sandbox server nonce:**
- `cnon:card-nonce-ok`

---

## Pending / next steps

1. **Configure custom domain.** Currently shipping at `beauty-booking-three.vercel.app`. Pick a subdomain (e.g. `book.ashleylacy.com` or `ashley.muzeoffice.com`).
2. **Wire Square production webhook subscription** to `<canonical URL>/api/webhooks/square` with events: `payment.created`, `payment.updated`, `refund.created`, `refund.updated`, `dispute.created`, `dispute.state.updated`. Set the signature key in Vercel as `SQUARE_WEBHOOK_SIGNATURE_KEY`. Verify with a `$0.01` test payment.
3. **Delete stale Vercel projects** `beautybook` and `beautybook-za5x` (the linked one is `beauty-booking`).
4. **Add `/admin/services` link to admin nav** (currently reachable only by typing the URL).
5. **Disable Vercel SSO** on production once you want public access (currently every preview + prod URL is protected by Vercel auth).

---

## Useful commands

### Dev
```bash
npm run dev                                     # → localhost:3100
npm run build                                   # Validate build
```

### Generate a new Drizzle migration after editing schema
```bash
npx drizzle-kit generate
```

### Apply migrations to Neon (non-interactive, works in CI)
```bash
node --env-file=.env.local -e "
  import('postgres').then(async ({ default: pg }) => {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const sql = pg(process.env.DATABASE_URL_UNPOOLED, { max: 1 });
    await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
    await sql.end();
    console.log('✓ migrations applied');
  });
"
```

### Quick DB peek
```bash
node --env-file=.env.local -e "
  import('postgres').then(async ({ default: pg }) => {
    const sql = pg(process.env.DATABASE_URL, { prepare: false });
    const rows = await sql\`select code, customer_name, service_name, scheduled_date, status, balance_status, refund_status from bookings order by created_at desc limit 10\`;
    console.table(rows);
    await sql.end();
  });
"
```

### Sync local env from Vercel
```bash
npx vercel env pull .env.local
```

### Deploy
```bash
npx vercel --prod        # production
npx vercel               # preview
```
