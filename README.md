# Beauty Booking MVP

Mobile-first esthetician booking app for the Muze Office amenity ecosystem.

## What is included

- Guest booking flow with service selection, slot selection, customer intake, and cancellation policy review
- Customer self-service portal for rescheduling and cancelling appointments
- Simple admin dashboard for appointments, revenue tracking, cancellation handling, and retention follow-up
- Supabase, Stripe, Resend, and Vercel readiness indicators

## Stack

- Next.js App Router
- React 19
- CSS-first styling for a lightweight deploy
- Supabase for bookings, customers, and provider availability
- Stripe for deposits, full charges, and cancellation fees
- Resend for confirmations, reminders, and marketing touchpoints
- Vercel for deployment

## Recommended Supabase tables

- `providers`
- `services`
- `availability_rules`
- `bookings`
- `customers`
- `payments`
- `cancellation_events`
- `marketing_events`

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`

## Local development

```bash
npm install
npm run dev
```

## Next implementation steps

1. Replace demo data in `lib/demo-data.js` with real Supabase queries and mutations.
2. Create Stripe checkout/session routes and store payment intent metadata on bookings.
3. Add authenticated esthetician access to `/admin`.
4. Add Resend email templates for confirmation, reminder, cancellation, and retention campaigns.
5. Add Supabase Row Level Security for esthetician/provider ownership and customer self-service tokens.
