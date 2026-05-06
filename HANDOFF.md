# Beauty Booking — Master Reference & Handoff

Mobile-first booking app for **Ashley Lacy Esthetics** (esthetician practice), built as part of the Muze Office amenity ecosystem. Live card payments via Square, booking records in Neon Postgres.

**Last updated:** 2026-04-08

---

## Current state

| Area | Status |
|---|---|
| Square sandbox payments (deposit + full charge) | ✅ Working E2E |
| Neon Postgres schema + CRUD | ✅ Live |
| Customer portal (lookup / reschedule / cancel) | ✅ DB-backed |
| Admin dashboard (list / confirm / cancel / collect-balance) | ✅ DB-backed |
| Square Payment Link balance collection | ✅ Working E2E |
| Square webhook handler (HMAC-verified) | ✅ Code ready, not wired to prod webhook yet |
| GitHub repo | ✅ `m-rokai/beautybook`, branch `main` |
| Vercel deployment | ⏳ In progress (importing via vercel.com/new) |
| Admin auth | ❌ Not started — `/admin` is currently public |
| Refund-on-cancel | ❌ Not started — cancel flips status but doesn't refund |
| Resend email | ❌ Not started — env var slot exists |

---

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Drizzle ORM** + **postgres.js** → **Neon Postgres**
- **Square Node SDK v44** (server — payments, payment links, webhooks)
- **Square Web Payments SDK** (browser — card tokenization)
- Vanilla CSS (~1700 lines in `app/globals.css`, hand-rolled, no Tailwind runtime despite Tailwind being in devDeps)
- JavaScript, not TypeScript (TS installed as devDep but app code is `.js`)

---

## Where things live

- **Local:** `~/Desktop/Ashley Lacy/beauty-booking`
- **GitHub:** https://github.com/m-rokai/beautybook (branch `main`)
- **Neon:** Connection strings in `.env.local`. Project hosted in `us-east-1`, Neon endpoint `ep-dry-fog-amk6sdpn`.
- **Square:** Sandbox app under Ashley's account. App ID `sandbox-sq0idb-730IJbjdJnTpznvLcTUI0w`, location `LYY2KY7VQN525` ("Default Test Account").
- **Vercel:** Deployment in progress as of this doc.

---

## Running locally

```bash
cd ~/Desktop/Ashley\ Lacy/beauty-booking
npm run dev      # → http://localhost:3100
```

**Dev server runs on port 3100**, not 3000 — the user's 3000 is occupied by another project. See `package.json` → `"dev": "next dev -p 3100"`.

---

## Environment variables

All secrets live in `.env.local` (gitignored). Template in `.env.example`.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection (runtime) |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (migrations) |
| `SQUARE_ENVIRONMENT` | `sandbox` or `production` |
| `SQUARE_ACCESS_TOKEN` | Square server API token |
| `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | Browser Web Payments SDK |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Browser Web Payments SDK |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Optional — required only once a webhook subscription exists |
| `NEXT_PUBLIC_APP_URL` | Currently `http://localhost:3100`, must become the Vercel URL after deploy |
| `RESEND_API_KEY` | Future — email integration not wired yet |

---

## Data model

**Single table: `bookings`** (27 columns, 5 indexes). Service catalog and add-ons remain hardcoded in `lib/demo-data.js` — only dynamic records live in Postgres.

Key columns:
- `code` — unique `AL-XXXXX` reference shown to customers
- `serviceId` / `serviceName` / `addOnNames` (text[])
- `scheduledDate` / `scheduledTimeId` / `scheduledTimeLabel`
- `customerName` / `customerEmail` / `customerPhone` / `customerNotes`
- `status` — `confirmed` | `pending` | `cancelled` | `rescheduled` | `completed`
- `paymentIntent` — `deposit` | `full`
- `totalCents` / `depositCents` / `remainingCents` — all money in cents
- `balanceStatus` — `paid` | `unpaid` | `link_sent`
- `depositSquarePaymentId` / `depositSquareStatus` / `depositSquareReceiptUrl`
- `balanceLinkId` / `balanceLinkUrl` / `balanceOrderId` / `balanceSquarePaymentId`
- `createdAt` / `updatedAt` (timestamptz)

Schema definition: `lib/db/schema.js`.
Migration SQL: `drizzle/0000_icy_shaman.sql` (committed).

---

## Architecture highlights

### 1. Atomic payment + booking insert
`POST /api/payments` handles both the Square charge and the DB insert in a single request. The **server** generates the booking code (no collisions), charges Square, then inserts the row. If the Square charge fails, no booking is written. If the Square charge succeeds but the DB write fails, the payment ID is surfaced in the error response so it can be reconciled manually. This was a deliberate fix to the earlier bug where the booking was saved client-side *after* the charge.

### 2. Balance collection flow
1. Admin clicks **Send payment link** in `/admin`
2. Frontend calls `POST /api/bookings/collect-balance` with just `{ bookingCode }`
3. Server looks up booking, calls `client.checkout.paymentLinks.create` with the remaining amount
4. Link URL persisted to `balanceLinkUrl`, `balanceStatus` → `link_sent`
5. Admin copies link and texts/emails it to the customer
6. Customer pays at `sandbox.square.link/u/...`
7. Square fires webhook → handler matches via `orderId` / `referenceId` / `note` → flips `balanceStatus` to `paid`

### 3. Webhook matching rules (order of confidence)
1. `payment.reference_id` matches `bookings.code` → deposit charge (set at create time)
2. `payment.order_id` matches `bookings.balanceOrderId` → balance link payment
3. `payment.note` matches `bookings.code` → fallback for balance payments

### 4. Client/server boundary in `lib/`
- `lib/db/*` + `lib/bookings-db.js` + `lib/square.js` → **server-only** (never import from client components)
- `lib/booking-store.js` → **client-safe** thin fetch wrappers + pure date helpers
- `lib/demo-data.js` → **shared**, pure data

---

## API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/payments` | POST | Atomic Square charge + booking insert |
| `/api/bookings` | GET | List all bookings (admin) |
| `/api/bookings/[code]` | GET | Find by code (portal + admin) |
| `/api/bookings/[code]` | PATCH | Update status/reschedule/cancel — whitelisted fields only |
| `/api/bookings/availability` | GET | Taken time slots for `?date=YYYY-MM-DD` |
| `/api/bookings/collect-balance` | POST | Create Square Payment Link, persist fields |
| `/api/webhooks/square` | POST | HMAC-verified, auto-updates booking state |
| `/api/platform-status` | GET | Readiness check for env vars |

---

## Key files

```
lib/
├── db/
│   ├── index.js         # Drizzle client (cached across HMR)
│   └── schema.js        # bookings table definition
├── bookings-db.js       # Server-only queries
├── booking-store.js     # Client-side async fetch wrappers + pure date helpers
├── square.js            # SquareClient factory + BigInt-safe JSON serializer
├── demo-data.js         # Static service catalog, add-ons, policies
└── platform.js          # Env readiness check

app/
├── api/
│   ├── bookings/
│   │   ├── route.js                  # GET list
│   │   ├── [code]/route.js           # GET + PATCH
│   │   ├── availability/route.js     # GET ?date=
│   │   └── collect-balance/route.js
│   ├── payments/route.js             # Charge + insert atomically
│   ├── webhooks/square/route.js      # HMAC-verified handler
│   └── platform-status/route.js
├── admin/page.js
├── booking/page.js
├── portal/page.js
├── page.js                           # Marketing home
├── layout.js
└── globals.css                       # ~1700 lines of hand-rolled CSS

components/
├── booking/BookingExperience.js      # Multi-step form + Square Web Payments SDK card mount
├── admin/AdminDashboard.js           # Appointments board + collect-balance UI
├── portal/CustomerPortal.js          # Code lookup + reschedule/cancel
└── SiteHeader.js

drizzle/
├── 0000_icy_shaman.sql               # Initial migration
└── meta/                             # Drizzle metadata
drizzle.config.js                     # Drizzle Kit config (loads .env.local)
```

---

## Known gotchas (read these before debugging anything)

1. **Dev port is 3100**, not 3000. Remember this when setting up ngrok tunnels or testing webhooks locally.
2. **Square sandbox rejects `@example.com` emails** — it's RFC-reserved. The `collect-balance` route auto-falls back to no `prePopulatedData` if Square returns an email-related error. Real emails work fine.
3. **Square Web Payments SDK has TWO CDNs.** Sandbox app IDs (`sandbox-*`) must load `https://sandbox.web.squarecdn.com/v1/square.js`. Production app IDs load `https://web.squarecdn.com/v1/square.js`. Detection is based on the app ID prefix in `BookingExperience.js`. If you load the wrong one the SDK errors with *"Web Payments SDK was initialized with an application ID created in sandbox however you are currently using production"*.
4. **Square SDK v44 is a rewrite.** Current API shapes:
   - `client.payments.create({ sourceId, idempotencyKey, amountMoney: { amount: BigInt(cents), currency: 'USD' }, locationId, referenceId, note, buyerEmailAddress })`
   - `client.checkout.paymentLinks.create({ idempotencyKey, description, quickPay: { name, priceMoney, locationId }, paymentNote, prePopulatedData })`
   - `client.locations.list()`
   - `WebhooksHelper.verifySignature({ requestBody, signatureHeader, signatureKey, notificationUrl })`
   - **Money amounts are `BigInt`**, not `number`. Use `BigInt(cents)` and `serializeSquare()` from `lib/square.js` before returning JSON.
5. **Drizzle Kit `push` is interactive.** Use `drizzle-kit generate` + `drizzle-orm/postgres-js/migrator` for non-TTY environments (see commands below). The existing migration in `drizzle/` was applied this way.
6. **Neon free tier is 10 projects** (vs Supabase's 2). That's why we picked Neon — the user was at Supabase's project limit from other work (Stackt, SpaceSync).
7. **Admin route is public.** `/admin` has no auth gate. Do not deploy to production without adding Clerk or a passcode check.
8. **Neon DB credentials in `.env.local` were shared in LLM chat during sandbox setup.** Rotate before production via Neon console → Settings → Reset password.

---

## Test credentials (Square sandbox)

**Browser card form:**
- Card: `4111 1111 1111 1111`
- Expiry: any future date (`12/34` works)
- CVV: `111`
- ZIP: `94103`

**Server-side test nonce** (for curl / Node smoke tests):
- `cnon:card-nonce-ok`

**Existing test booking:** `AL-KE4HD` — has a deposit charged and a balance payment link generated. Check it's still there with `GET /api/bookings/AL-KE4HD`.

---

## Pending / next steps (priority order)

1. **⏳ Complete Vercel deployment** — user is mid-import at vercel.com/new. Needs env vars pasted from `.env.local`.
2. **Update `NEXT_PUBLIC_APP_URL`** on Vercel to the real deployed URL and redeploy.
3. **Wire real Square webhook subscription** at Square Developer Dashboard → point at `https://<vercel-url>/api/webhooks/square` → subscribe to `payment.created`, `payment.updated`, `refund.created`, `refund.updated`, `dispute.created`, `dispute.state.updated` → paste signature key into Vercel env (`SQUARE_WEBHOOK_SIGNATURE_KEY`) → redeploy. After this, balance payments auto-mark paid with zero admin action.
4. **Admin auth.** Clerk (10k MAU free tier) or a simple passcode env var gate. Required before production.
5. **Refund on cancel.** The admin Cancel button currently just flips status. Should call `client.refunds.refundPayment` for the deposit.
6. **Resend integration** for booking confirmation / 24h reminder / aftercare emails.
7. **Rotate credentials** (Neon + Square) before production — sandbox creds were shared in LLM chat.
8. **Services in DB** — currently hardcoded. Admin-editable service menu is a future win, not an MVP blocker.

---

## Git history (relevant)

- `d99d921e` — Build Muze Office beauty booking MVP (initial scaffold, pre-this-work)
- `5ad77dd7` — Add Square payments and balance collection
- `fe67546a` — Migrate from localStorage to Neon Postgres via Drizzle (latest)

---

## Useful commands

### Dev
```bash
npm run dev                                     # → localhost:3100
npx next build                                  # Validate build
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
    const rows = await sql\`select code, customer_name, service_name, scheduled_date, balance_status from bookings order by created_at desc limit 10\`;
    console.table(rows);
    await sql.end();
  });
"
```

### Smoke test the whole payment flow from terminal
```bash
curl -s -X POST http://localhost:3100/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "cnon:card-nonce-ok",
    "booking": {
      "serviceId": "customized-facial",
      "serviceName": "Customized Facial",
      "addOnNames": [],
      "scheduledDate": "2026-05-01",
      "scheduledTimeId": "1030",
      "scheduledTimeLabel": "10:30 AM",
      "customerName": "Smoke Test",
      "customerEmail": "smoke@test.com",
      "paymentIntent": "deposit",
      "totalCents": 7500,
      "depositCents": 2500,
      "remainingCents": 5000
    }
  }'
```
