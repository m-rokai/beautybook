import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSquareClient, serializeSquare } from '../../../lib/square';
import {
  generateUniqueBookingCode,
  insertBooking,
  updateBookingByCode,
} from '../../../lib/bookings-db';
import { sendBookingConfirmation } from '../../../lib/mailer';
import { truncate } from '../../../lib/pricing';
import { recordBookingEvent } from '../../../lib/booking-events';

// POST /api/payments
// Atomic flow:
//   1. Validate incoming booking draft.
//   2. Charge Square with the card token the client just tokenized.
//   3. Insert the booking row into Postgres with the payment ids attached.
//   4. Return the persisted booking (the client stores nothing of its own).
//
// Body shape:
// {
//   sourceId: string,                 // Square card nonce
//   booking: {
//     serviceId, serviceName, addOnNames,
//     scheduledDate, scheduledTimeId, scheduledTimeLabel,
//     customerName, customerEmail, customerPhone, customerNotes,
//     paymentIntent,                  // 'deposit' | 'full'
//     totalCents, depositCents, remainingCents,
//   }
// }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sourceId, booking } = body || {};

  if (!sourceId || typeof sourceId !== 'string') {
    return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 });
  }
  if (!booking || typeof booking !== 'object') {
    return NextResponse.json({ error: 'Missing booking payload' }, { status: 400 });
  }

  const required = [
    'serviceId',
    'serviceName',
    'scheduledDate',
    'scheduledTimeId',
    'scheduledTimeLabel',
    'customerName',
    'customerEmail',
    'paymentIntent',
    'totalCents',
    'depositCents',
    'remainingCents',
  ];
  for (const key of required) {
    if (booking[key] === undefined || booking[key] === null || booking[key] === '') {
      return NextResponse.json({ error: `Missing booking.${key}` }, { status: 400 });
    }
  }

  // serviceIds is the multi-select array. Fall back to [serviceId] for legacy
  // single-service callers so existing integrations keep working.
  const serviceIds =
    Array.isArray(booking.serviceIds) && booking.serviceIds.length > 0
      ? booking.serviceIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [booking.serviceId];

  const chargeCents =
    booking.paymentIntent === 'full' ? booking.totalCents : booking.depositCents;

  if (!Number.isInteger(chargeCents) || chargeCents <= 0) {
    return NextResponse.json(
      { error: 'Computed charge amount is invalid' },
      { status: 400 },
    );
  }

  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  if (!locationId) {
    return NextResponse.json(
      { error: 'Square location not configured' },
      { status: 500 },
    );
  }

  // 1. Reserve a unique booking code up front (used as Square reference_id so webhooks match).
  const code = await generateUniqueBookingCode();

  // 2. Charge Square
  let payment;
  try {
    const client = getSquareClient();
    const response = await client.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(chargeCents),
        currency: 'USD',
      },
      locationId,
      referenceId: code,
      // Square caps note at 500 chars — multi-service joined names can grow,
      // so truncate defensively.
      note: truncate(
        `${booking.serviceName} — ${booking.scheduledDate} ${booking.scheduledTimeLabel}`,
        480,
      ),
      buyerEmailAddress: booking.customerEmail,
    });
    payment = serializeSquare(response.payment);
  } catch (error) {
    console.error('[square] payments.create failed', error);
    const squareErrors = error?.errors || error?.body?.errors;
    const message =
      (Array.isArray(squareErrors) && squareErrors[0]?.detail) ||
      error?.message ||
      'Payment failed';
    return NextResponse.json({ error: message }, { status: 402 });
  }

  // 3. Persist the booking. If the DB write fails after Square succeeded we still return
  //    the payment id so support can reconcile manually — but in practice Neon is as
  //    reliable as Square so this branch should be rare.
  try {
    const row = await insertBooking({
      code,
      serviceId: serviceIds[0],
      serviceName: booking.serviceName,
      serviceIds,
      addOnNames: Array.isArray(booking.addOnNames) ? booking.addOnNames : [],
      scheduledDate: booking.scheduledDate,
      scheduledTimeId: booking.scheduledTimeId,
      scheduledTimeLabel: booking.scheduledTimeLabel,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone || null,
      customerNotes: booking.customerNotes || null,
      status: 'confirmed',
      paymentIntent: booking.paymentIntent,
      totalCents: booking.totalCents,
      depositCents: booking.depositCents,
      remainingCents: booking.remainingCents,
      balanceStatus: booking.remainingCents > 0 ? 'unpaid' : 'paid',
      depositSquarePaymentId: payment?.id ?? null,
      depositSquareStatus: payment?.status ?? null,
      depositSquareReceiptUrl: payment?.receiptUrl ?? null,
    });

    // Audit log: booking created.
    recordBookingEvent({
      bookingId: row.id,
      bookingCode: row.code,
      eventType: 'created',
      summary: `Booking created · ${row.serviceName} · ${row.scheduledDate} ${row.scheduledTimeLabel}`,
      payload: {
        serviceIds: row.serviceIds,
        addOnNames: row.addOnNames,
        totalCents: row.totalCents,
        depositCents: row.depositCents,
        paymentIntent: row.paymentIntent,
      },
      actor: 'customer',
    }).catch(() => {});

    // Best-effort confirmation email — never block the booking on SMTP.
    sendBookingConfirmation(row).catch((err) => {
      console.error('[mailer] confirmation send rejected', err);
    });

    return NextResponse.json({ ok: true, booking: row });
  } catch (dbError) {
    console.error('[db] insertBooking failed after successful Square charge', dbError);
    // Try to refund? For MVP we log and surface a loud error so the operator can reconcile.
    return NextResponse.json(
      {
        error:
          'Payment succeeded but booking record failed to save. Please contact support with reference ' +
          (payment?.id ?? 'unknown') +
          '.',
        paymentId: payment?.id ?? null,
      },
      { status: 500 },
    );
  }
}
