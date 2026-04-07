import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSquareClient, serializeSquare } from '../../../lib/square';

// POST /api/payments
// body: { sourceId, amountCents, bookingCode, customer: { name, email, phone }, note }
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { sourceId, amountCents, bookingCode, customer = {}, note } = body;

  if (!sourceId || typeof sourceId !== 'string') {
    return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 });
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

    const response = await client.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      locationId,
      referenceId: bookingCode || undefined,
      note: note || (bookingCode ? `Ashley Lacy Aesthetics — ${bookingCode}` : undefined),
      buyerEmailAddress: customer.email || undefined,
    });

    const payment = serializeSquare(response.payment);

    return NextResponse.json({
      ok: true,
      paymentId: payment?.id ?? null,
      status: payment?.status ?? null,
      receiptUrl: payment?.receiptUrl ?? null,
      amount: payment?.amountMoney?.amount ?? null,
    });
  } catch (error) {
    console.error('[square] payments.create failed', error);

    // Square SDK errors expose an `errors` array with actionable detail
    const squareErrors = error?.errors || error?.body?.errors;
    const message =
      (Array.isArray(squareErrors) && squareErrors[0]?.detail) ||
      error?.message ||
      'Payment failed';

    return NextResponse.json({ error: message }, { status: 402 });
  }
}
