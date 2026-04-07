import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSquareClient, serializeSquare } from '../../../../lib/square';
import {
  findBookingByCode,
  updateBookingByCode,
} from '../../../../lib/bookings-db';

// POST /api/bookings/collect-balance
// body: { bookingCode }
//
// Looks up the booking in Postgres, creates a Square Payment Link for the
// remaining balance, and persists the link fields back to the booking row.
// The admin UI receives the updated booking and displays the hosted URL.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { bookingCode } = body || {};
  if (!bookingCode || typeof bookingCode !== 'string') {
    return NextResponse.json({ error: 'Missing bookingCode' }, { status: 400 });
  }

  const booking = await findBookingByCode(bookingCode);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.balanceStatus === 'paid' || booking.remainingCents <= 0) {
    return NextResponse.json(
      { error: 'Booking has no outstanding balance' },
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

  const client = getSquareClient();

  const buildRequest = (withEmail) => ({
    idempotencyKey: randomUUID(),
    description: `Balance for booking ${booking.code}`,
    quickPay: {
      name: `${booking.serviceName} — remaining balance`,
      priceMoney: {
        amount: BigInt(booking.remainingCents),
        currency: 'USD',
      },
      locationId,
    },
    // paymentNote becomes the `note` on the resulting Payment so webhooks can match.
    paymentNote: booking.code,
    prePopulatedData:
      withEmail && booking.customerEmail ? { buyerEmail: booking.customerEmail } : undefined,
  });

  try {
    let response;
    try {
      response = await client.checkout.paymentLinks.create(buildRequest(true));
    } catch (err) {
      // Square rejects certain addresses (e.g. @example.com). Retry without the
      // prefilled email so the admin still gets a usable link.
      const squareErrs = err?.errors || err?.body?.errors || [];
      const emailError = squareErrs.some((e) =>
        String(e?.detail || '').toLowerCase().includes('email'),
      );
      if (emailError) {
        console.warn('[collect-balance] retrying without prepopulated email');
        response = await client.checkout.paymentLinks.create(buildRequest(false));
      } else {
        throw err;
      }
    }

    const link = serializeSquare(response.paymentLink);
    if (!link?.url) {
      throw new Error('Square did not return a payment link URL');
    }

    const updated = await updateBookingByCode(booking.code, {
      balanceStatus: 'link_sent',
      balanceLinkId: link.id,
      balanceLinkUrl: link.url,
      balanceOrderId: link.orderId ?? null,
    });

    return NextResponse.json({ ok: true, booking: updated });
  } catch (error) {
    console.error('[square] paymentLinks.create failed', error);
    const squareErrors = error?.errors || error?.body?.errors;
    const message =
      (Array.isArray(squareErrors) && squareErrors[0]?.detail) ||
      error?.message ||
      'Could not create payment link';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
