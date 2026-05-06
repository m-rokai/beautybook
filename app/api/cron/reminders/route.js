import { NextResponse } from 'next/server';
import { eq, and, isNull, ne } from 'drizzle-orm';
import { db } from '../../../../lib/db';
import { bookings } from '../../../../lib/db/schema';
import { sendBookingReminder } from '../../../../lib/mailer';
import { recordBookingEvent } from '../../../../lib/booking-events';

// GET /api/cron/reminders — Vercel Cron entry point.
//
// Sends a 24-hour reminder email to every confirmed booking scheduled for
// tomorrow (Pacific time) that hasn't already had one sent.
//
// Schedule (vercel.json): `0 16 * * *` — 16:00 UTC daily, which is 9:00 AM
// PDT (8:00 AM PST). Both well within the 5 AM – 12 AM Pacific window the
// user requested. Cron secret check rejects manual hits without the
// Authorization: Bearer header Vercel attaches automatically.
export const dynamic = 'force-dynamic';

function tomorrowKey() {
  // Tomorrow's date in Pacific time, formatted as YYYY-MM-DD to match the
  // booking's `scheduled_date` column. Using LA via Intl makes this DST-safe.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return fmt.format(tomorrow); // "YYYY-MM-DD"
}

export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  // If a CRON_SECRET is configured, require a matching Bearer token. Vercel
  // sends this automatically on cron invocations. Without the secret we bail —
  // never let an unauthenticated GET fan out emails.
  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[cron/reminders] CRON_SECRET not set — refusing to run');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }

  const dateKey = tomorrowKey();

  let due;
  try {
    due = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.scheduledDate, dateKey),
          ne(bookings.status, 'cancelled'),
          isNull(bookings.reminderSentAt),
        ),
      );
  } catch (err) {
    console.error('[cron/reminders] query failed', err);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  for (const booking of due) {
    try {
      const result = await sendBookingReminder(booking);
      if (result?.ok || result?.skipped) {
        // Mark sent — even on `skipped` (e.g. missing email) we don't want
        // to retry on every cron invocation.
        await db
          .update(bookings)
          .set({ reminderSentAt: new Date() })
          .where(eq(bookings.id, booking.id));
        sent += 1;
        recordBookingEvent({
          bookingId: booking.id,
          bookingCode: booking.code,
          eventType: 'reminder_sent',
          summary: `24-hour reminder ${result?.ok ? 'emailed' : 'skipped (no recipient/SMTP not configured)'}`,
          actor: 'system',
        }).catch(() => {});
      } else {
        failed += 1;
      }
    } catch (err) {
      console.error('[cron/reminders] send failed', booking.code, err);
      failed += 1;
    }
  }

  return NextResponse.json({
    date: dateKey,
    eligible: due.length,
    sent,
    failed,
  });
}
