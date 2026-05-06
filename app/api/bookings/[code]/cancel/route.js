import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSquareClient, serializeSquare } from '../../../../../lib/square';
import {
  findBookingByCode,
  updateBookingByCode,
} from '../../../../../lib/bookings-db';
import { getSession } from '../../../../../lib/auth-helpers';

// POST /api/bookings/:code/cancel  (admin only)
//
// Body: { refund: 'deposit' | 'full' | 'none' }
//   - 'deposit' (default): refund the deposit, leave any unpaid balance alone.
//   - 'full': also refund the balance payment if the customer already paid it.
//             For deposit-only bookings this is identical to 'deposit'.
//   - 'none': no Square calls; just flip status. Use when Ashley already
//             refunded out-of-band, or for very old bookings missing payment ids.
//
// Behavior:
//   - Idempotent: refusing to re-cancel an already-cancelled booking prevents
//     accidental double-refunds. Square's idempotency key would also catch
//     this, but rejecting at the API layer is faster and clearer.
//   - Atomic-enough: refund first, DB write after. If the refund call fails
//     we return the error and DON'T flip status — admin can retry.
//   - Webhook-friendly: refund.created/updated webhooks will arrive afterward;
//     they're a no-op (logged) since we already wrote refund state here.
const VALID_REFUND_MODES = new Set(['deposit', 'full', 'none']);

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const refundMode = body?.refund && VALID_REFUND_MODES.has(body.refund)
    ? body.refund
    : 'deposit';

  const booking = await findBookingByCode(code);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Booking is already cancelled' },
      { status: 409 },
    );
  }

  const refundsToIssue = [];
  if (refundMode !== 'none') {
    if (booking.depositSquarePaymentId && (booking.depositCents ?? 0) > 0) {
      refundsToIssue.push({
        kind: 'deposit',
        paymentId: booking.depositSquarePaymentId,
        cents: booking.depositCents,
      });
    }
    if (refundMode === 'full' && booking.balanceStatus === 'paid' && booking.balanceSquarePaymentId) {
      // remainingCents was zeroed on payment, but for older rows we fall back to
      // (totalCents - depositCents).
      const balanceCents = booking.totalCents - booking.depositCents;
      if (balanceCents > 0) {
        refundsToIssue.push({
          kind: 'balance',
          paymentId: booking.balanceSquarePaymentId,
          cents: balanceCents,
        });
      }
    }
  }

  // 1. Issue refunds.
  let refundDepositSquareId = null;
  let refundBalanceSquareId = null;
  let refundedCents = 0;
  let refundStatus = refundMode === 'none' ? null : 'completed';
  let lowestStatus = 'COMPLETED';

  try {
    const client = getSquareClient();
    for (const r of refundsToIssue) {
      const response = await client.refunds.refundPayment({
        idempotencyKey: `${code}-refund-${r.kind}`,
        paymentId: r.paymentId,
        amountMoney: { amount: BigInt(r.cents), currency: 'USD' },
        reason: 'Booking cancelled',
      });
      const refund = serializeSquare(response.refund);
      if (r.kind === 'deposit') refundDepositSquareId = refund?.id ?? null;
      if (r.kind === 'balance') refundBalanceSquareId = refund?.id ?? null;
      refundedCents += r.cents;
      // Square may return PENDING; reflect that on the booking so the admin
      // sees "refund pending" until the webhook flips it to completed.
      if (refund?.status && refund.status !== 'COMPLETED') lowestStatus = refund.status;
    }
    if (refundsToIssue.length > 0 && lowestStatus !== 'COMPLETED') {
      refundStatus = 'pending';
    }
  } catch (error) {
    console.error('[cancel] Square refund failed', error);
    const squareErrors = error?.errors || error?.body?.errors;
    const message =
      (Array.isArray(squareErrors) && squareErrors[0]?.detail) ||
      error?.message ||
      'Refund failed';
    // Persist the failure so the admin can see it without re-triggering.
    await updateBookingByCode(code, {
      refundStatus: 'failed',
      refundError: message,
    });
    return NextResponse.json({ error: message, refundFailed: true }, { status: 502 });
  }

  // 2. Flip status + record refund metadata.
  try {
    const updated = await updateBookingByCode(code, {
      status: 'cancelled',
      ...(refundStatus !== null
        ? {
            refundStatus,
            refundCents: refundedCents,
            refundedAt: new Date(),
            refundDepositSquareId,
            refundBalanceSquareId,
            refundError: null,
          }
        : {}),
    });
    return NextResponse.json({ booking: updated, refundedCents });
  } catch (error) {
    console.error('[cancel] DB write failed after refund', error);
    return NextResponse.json(
      {
        error:
          'Refund issued but booking record could not be updated. ' +
          (refundDepositSquareId ? `Deposit refund: ${refundDepositSquareId}. ` : '') +
          (refundBalanceSquareId ? `Balance refund: ${refundBalanceSquareId}. ` : ''),
      },
      { status: 500 },
    );
  }
}
