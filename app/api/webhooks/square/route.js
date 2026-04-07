import { NextResponse } from 'next/server';
import { WebhooksHelper } from 'square';

// Square posts JSON. We must read the raw body for signature verification.
export async function POST(request) {
  const rawBody = await request.text();

  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const signatureHeader = request.headers.get('x-square-hmacsha256-signature');
  const notificationUrl =
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/webhooks/square`
      : null;

  if (!signatureKey || !signatureHeader || !notificationUrl) {
    console.warn('[square-webhook] missing signature config — rejecting');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  let verified = false;
  try {
    verified = await WebhooksHelper.verifySignature({
      requestBody: rawBody,
      signatureHeader,
      signatureKey,
      notificationUrl,
    });
  } catch (error) {
    console.error('[square-webhook] verifySignature threw', error);
  }

  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = event?.type;
  const dataObject = event?.data?.object;

  // Minimal dispatch. Replace console logs with Supabase updates once wired up.
  switch (type) {
    case 'payment.created':
    case 'payment.updated': {
      const payment = dataObject?.payment;
      // `reference_id` is set when the booking deposit was charged via /api/payments.
      // `note` contains the booking code when payment came from a balance Payment Link.
      // `order_id` lets us match a payment back to a stored `balanceOrderId` on a booking.
      console.log('[square-webhook] payment', {
        id: payment?.id,
        status: payment?.status,
        referenceId: payment?.reference_id,
        note: payment?.note,
        orderId: payment?.order_id,
      });
      // TODO(supabase): find booking by reference_id OR note OR balanceOrderId === order_id,
      // then mark balanceStatus = 'paid' if it was a balance payment.
      break;
    }
    case 'refund.created':
    case 'refund.updated': {
      const refund = dataObject?.refund;
      console.log('[square-webhook] refund', refund?.id, refund?.status);
      break;
    }
    case 'dispute.created':
    case 'dispute.state.updated': {
      const dispute = dataObject?.dispute;
      console.log('[square-webhook] dispute', dispute?.id, dispute?.state);
      break;
    }
    default:
      console.log('[square-webhook] unhandled event', type);
  }

  return NextResponse.json({ received: true });
}
