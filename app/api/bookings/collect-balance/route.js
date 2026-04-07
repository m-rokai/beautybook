import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSquareClient, serializeSquare } from '../../../../lib/square';

// POST /api/bookings/collect-balance
// body: { bookingCode, amountCents, serviceName, customer: { name, email } }
// Creates a Square Payment Link (Quick Pay) for the remaining balance and
// returns the hosted checkout URL so the admin can text/email it to the client.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { bookingCode, amountCents, serviceName, customer = {} } = body;

  if (!bookingCode || typeof bookingCode !== 'string') {
    return NextResponse.json({ error: 'Missing bookingCode' }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be a positive integer' }, { status: 400 });
  }

  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  if (!locationId) {
    return NextResponse.json({ error: 'Square location not configured' }, { status: 500 });
  }

  try {
    const client = getSquareClient();

    const itemName = serviceName
      ? `${serviceName} — remaining balance`
      : 'Remaining balance';

    const response = await client.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      description: `Balance for booking ${bookingCode}`,
      quickPay: {
        name: itemName,
        priceMoney: {
          amount: BigInt(amountCents),
          currency: 'USD',
        },
        locationId,
      },
      // paymentNote becomes the `note` field on the resulting Payment so we can match
      // it back to this booking via the webhook.
      paymentNote: bookingCode,
      prePopulatedData: customer.email
        ? { buyerEmail: customer.email }
        : undefined,
    });

    const link = serializeSquare(response.paymentLink);

    if (!link?.url) {
      throw new Error('Square did not return a payment link URL');
    }

    return NextResponse.json({
      ok: true,
      linkId: link.id,
      url: link.url,
      orderId: link.orderId ?? null,
    });
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
