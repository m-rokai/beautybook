import { NextResponse } from 'next/server';
import {
  findBookingByCode,
  updateBookingByCode,
} from '../../../../../lib/bookings-db';
import { getSession } from '../../../../../lib/auth-helpers';
import { getServiceMap } from '../../../../../lib/services-db';

// PATCH /api/bookings/:code/services  (admin only)
//
// Body: { serviceIds: string[], addOnNames?: string[] }
//
// Replaces the booking's full service list (and optionally add-ons),
// recomputes totalCents from the catalog, and updates the
// remaining/balance fields.
//
// Money handling:
// - depositCents stays as the actual amount charged to the original card
//   (we don't auto-charge the difference or auto-refund the excess —
//   Ashley uses the existing balance-link or refund flow as needed).
// - remainingCents = max(0, totalCents - depositCents)
// - If new total > deposit, balanceStatus flips to 'unpaid' (or stays
//   wherever it was if a link is already in flight).
// - If new total < deposit, remaining is clamped to 0 and the response
//   surfaces a `creditOwedCents` value so Ashley knows a partial refund
//   is appropriate.
export async function POST() {
  return NextResponse.json({ error: 'Use PATCH' }, { status: 405 });
}

export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Missing booking code' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body?.serviceIds) || body.serviceIds.length === 0) {
    return NextResponse.json(
      { error: 'serviceIds must be a non-empty array' },
      { status: 400 },
    );
  }
  const serviceIds = body.serviceIds.filter((id) => typeof id === 'string' && id.length > 0);
  if (serviceIds.length === 0) {
    return NextResponse.json({ error: 'No valid service ids supplied' }, { status: 400 });
  }
  const addOnNames = Array.isArray(body.addOnNames)
    ? body.addOnNames.filter((n) => typeof n === 'string')
    : null;

  const booking = await findBookingByCode(code);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json(
      { error: "Can't edit a cancelled booking" },
      { status: 409 },
    );
  }

  const serviceMap = await getServiceMap();
  const services = [];
  const missing = [];
  for (const id of serviceIds) {
    const s = serviceMap.get(id);
    if (s) services.push(s);
    else missing.push(id);
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Unknown or archived service: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  const newServiceTotal = services.reduce((sum, s) => sum + (s.priceCents ?? 0), 0);
  // Add-on totals: if the caller supplied addOnNames we'd ideally re-derive
  // their cents from the catalog, but add-ons live in lib/demo-data and
  // don't have a stable id per-row. For now, retain the existing total minus
  // the existing service portion to preserve add-on contribution.
  const existingServiceTotal = (() => {
    if (!Array.isArray(booking.serviceIds) || booking.serviceIds.length === 0) {
      // legacy single-service row — treat the whole total minus the portion
      // we can't account for as the previous service amount.
      return booking.totalCents - 0; // best effort; assume no add-ons portion
    }
    return booking.serviceIds.reduce(
      (sum, id) => sum + (serviceMap.get(id)?.priceCents ?? 0),
      0,
    );
  })();
  const carriedAddOnCents = Math.max(0, booking.totalCents - existingServiceTotal);

  const newTotalCents = newServiceTotal + carriedAddOnCents;
  const depositCents = booking.depositCents; // do not modify what was charged
  const newRemainingCents = Math.max(0, newTotalCents - depositCents);
  const creditOwedCents = Math.max(0, depositCents - newTotalCents);

  // balanceStatus: if there's a remaining amount and the prior status was
  // 'paid', flip back to 'unpaid' so Ashley can collect. If a link was sent,
  // leave it (admin can regenerate). If remaining is 0, mark 'paid'.
  let balanceStatus = booking.balanceStatus;
  if (newRemainingCents === 0) balanceStatus = 'paid';
  else if (balanceStatus === 'paid') balanceStatus = 'unpaid';

  const serviceName = services.map((s) => s.name).join(' + ');

  try {
    const updated = await updateBookingByCode(code, {
      serviceId: services[0].id,
      serviceName,
      serviceIds,
      ...(addOnNames !== null ? { addOnNames } : {}),
      totalCents: newTotalCents,
      remainingCents: newRemainingCents,
      balanceStatus,
    });
    return NextResponse.json({
      booking: updated,
      creditOwedCents,
      delta: {
        previousTotalCents: booking.totalCents,
        newTotalCents,
        previousRemainingCents: booking.remainingCents,
        newRemainingCents,
      },
    });
  } catch (err) {
    console.error('[admin/bookings/services] update failed', err);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}
