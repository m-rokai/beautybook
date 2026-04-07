import { NextResponse } from 'next/server';
import { WebhooksHelper } from 'square';
import {
  findBookingByBalanceOrderId,
  findBookingByCode,
  updateBookingByCode,
} from '../../../../lib/bookings-db';

// Square posts JSON. We must read the raw body for signature verification.
export async function POST(request) {
  const rawBody = await request.text();

  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const signatureHeader = request.headers.get('x-square-hmacsha256-signature');
  const notificationUrl = process.env.NEXT_PUBLIC_APP_URL
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

  try {
    switch (type) {
      case 'payment.created':
      case 'payment.updated': {
        await handlePaymentEvent(dataObject?.payment);
        break;
      }
      case 'refund.created':
      case 'refund.updated': {
        const refund = dataObject?.refund;
        console.log('[square-webhook] refund', refund?.id, refund?.status);
        // TODO: mark booking as refunded when we support cancellations with refunds.
        break;
      }
      case 'dispute.created':
      case 'dispute.state.updated': {
        const dispute = dataObject?.dispute;
        console.warn('[square-webhook] dispute', dispute?.id, dispute?.state);
        break;
      }
      default:
        console.log('[square-webhook] unhandled event', type);
    }
  } catch (error) {
    // Never throw back at Square — acknowledge so it won't retry forever; we'll
    // surface the failure in logs and reconcile manually if needed.
    console.error('[square-webhook] handler threw', error);
  }

  return NextResponse.json({ received: true });
}

/**
 * Match a Square payment event back to a booking and update its state.
 *
 * Matching rules (in order of confidence):
 *   1. The deposit charge sets `reference_id = <bookingCode>` → look up by code.
 *   2. The balance charge (from a Payment Link) sets `note = <bookingCode>` AND carries
 *      an `order_id` that matches the stored `balance_order_id`. We try order_id first
 *      (more reliable), then fall back to matching by note.
 */
async function handlePaymentEvent(payment) {
  if (!payment) return;

  const referenceId = payment.reference_id || payment.referenceId;
  const note = payment.note;
  const orderId = payment.order_id || payment.orderId;
  const paymentId = payment.id;
  const status = payment.status;
  const receiptUrl = payment.receipt_url || payment.receiptUrl;

  console.log('[square-webhook] payment', { paymentId, status, referenceId, note, orderId });

  // Case 1: deposit charge — reference_id is the booking code
  if (referenceId) {
    const booking = await findBookingByCode(referenceId);
    if (booking) {
      await updateBookingByCode(booking.code, {
        // Only update status; don't overwrite ids we set at create time.
        ...(status ? { depositSquareStatus: status } : {}),
        ...(receiptUrl && !booking.depositSquareReceiptUrl
          ? { depositSquareReceiptUrl: receiptUrl }
          : {}),
      });
      return;
    }
  }

  // Case 2: balance payment — match by order_id, then by note
  if (orderId) {
    const booking = await findBookingByBalanceOrderId(orderId);
    if (booking && status === 'COMPLETED') {
      await updateBookingByCode(booking.code, {
        balanceStatus: 'paid',
        balanceSquarePaymentId: paymentId,
      });
      return;
    }
  }

  if (note) {
    const booking = await findBookingByCode(note);
    if (booking && status === 'COMPLETED' && booking.balanceStatus !== 'paid') {
      await updateBookingByCode(booking.code, {
        balanceStatus: 'paid',
        balanceSquarePaymentId: paymentId,
      });
    }
  }
}
