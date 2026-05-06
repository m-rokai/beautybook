import { NextResponse } from 'next/server';
import {
  findBookingByCode,
  updateBookingByCode,
} from '../../../../../lib/bookings-db';
import { getSession } from '../../../../../lib/auth-helpers';
import { getServiceMap } from '../../../../../lib/services-db';
import { addOns as addOnCatalog } from '../../../../../lib/demo-data';
import { recordBookingEvent } from '../../../../../lib/booking-events';
import { sendBookingUpdateNotice } from '../../../../../lib/mailer';

const addOnByName = new Map(addOnCatalog.map((a) => [a.name, a]));

function diffArray(before, after) {
  const beforeSet = new Set(before || []);
  const afterSet = new Set(after || []);
  const added = [...afterSet].filter((x) => !beforeSet.has(x));
  const removed = [...beforeSet].filter((x) => !afterSet.has(x));
  return { added, removed };
}

// PATCH /api/bookings/:code/services  (admin only)
//
// Body: { serviceIds: string[], addOnNames?: string[] }
//
// Recomputes totalCents from the live DB catalog (services) + the static
// add-on catalog (lib/demo-data). depositCents is preserved (= what was
// actually charged); remainingCents/balanceStatus are derived. Records a
// services_edited audit event and emails the customer a branded update
// notice listing the specific changes.
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

  const serviceIds = Array.isArray(body?.serviceIds)
    ? body.serviceIds.filter((id) => typeof id === 'string' && id.length > 0)
    : null;
  if (!serviceIds || serviceIds.length === 0) {
    return NextResponse.json({ error: 'serviceIds must be a non-empty array' }, { status: 400 });
  }

  const addOnNames = Array.isArray(body?.addOnNames)
    ? body.addOnNames.filter((n) => typeof n === 'string')
    : null;

  const booking = await findBookingByCode(code);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: "Can't edit a cancelled booking" }, { status: 409 });
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

  // Resolve add-on totals from the static catalog. If no add-on update was
  // sent, retain whatever's already on the booking (and price it from the
  // catalog so the total stays consistent).
  const finalAddOnNames = addOnNames !== null ? addOnNames : booking.addOnNames || [];
  const newAddOnTotal = finalAddOnNames.reduce(
    (sum, name) => sum + (addOnByName.get(name)?.priceNum ?? 0) * 100,
    0,
  );

  const newTotalCents = newServiceTotal + newAddOnTotal;
  const depositCents = booking.depositCents; // preserved — actual charge on card
  const newRemainingCents = Math.max(0, newTotalCents - depositCents);
  const creditOwedCents = Math.max(0, depositCents - newTotalCents);

  let balanceStatus = booking.balanceStatus;
  if (newRemainingCents === 0) balanceStatus = 'paid';
  else if (balanceStatus === 'paid') balanceStatus = 'unpaid';

  const serviceName = services.map((s) => s.name).join(' + ');

  // Build a human-readable change list before persisting.
  const prevServiceIds = Array.isArray(booking.serviceIds) && booking.serviceIds.length > 0
    ? booking.serviceIds
    : booking.serviceId ? [booking.serviceId] : [];
  const serviceDiff = diffArray(prevServiceIds, serviceIds);
  const addOnDiff = diffArray(booking.addOnNames || [], finalAddOnNames);

  const changeLines = [];
  for (const id of serviceDiff.added) {
    const name = serviceMap.get(id)?.name || id;
    changeLines.push(`Added service: ${name}`);
  }
  for (const id of serviceDiff.removed) {
    const name = serviceMap.get(id)?.name || id;
    changeLines.push(`Removed service: ${name}`);
  }
  for (const name of addOnDiff.added) changeLines.push(`Added add-on: ${name}`);
  for (const name of addOnDiff.removed) changeLines.push(`Removed add-on: ${name}`);

  if (newTotalCents !== booking.totalCents) {
    const delta = newTotalCents - booking.totalCents;
    changeLines.push(`Total ${delta > 0 ? 'increased' : 'decreased'} by $${(Math.abs(delta) / 100).toFixed(0)} (now $${(newTotalCents / 100).toFixed(0)})`);
  }

  if (changeLines.length === 0) {
    return NextResponse.json({
      booking,
      creditOwedCents: 0,
      delta: { previousTotalCents: booking.totalCents, newTotalCents, previousRemainingCents: booking.remainingCents, newRemainingCents },
      noChange: true,
    });
  }

  try {
    const updated = await updateBookingByCode(code, {
      serviceId: services[0].id,
      serviceName,
      serviceIds,
      addOnNames: finalAddOnNames,
      totalCents: newTotalCents,
      remainingCents: newRemainingCents,
      balanceStatus,
    });

    // Audit + customer notification (best-effort — never block the API on these).
    recordBookingEvent({
      bookingId: updated.id,
      bookingCode: code,
      eventType: 'services_edited',
      summary: changeLines.join(' · '),
      payload: {
        before: {
          serviceIds: prevServiceIds,
          addOnNames: booking.addOnNames || [],
          totalCents: booking.totalCents,
          remainingCents: booking.remainingCents,
        },
        after: {
          serviceIds,
          addOnNames: finalAddOnNames,
          totalCents: newTotalCents,
          remainingCents: newRemainingCents,
        },
        changes: changeLines,
        creditOwedCents,
      },
      actor: `admin:${session.user.email || 'unknown'}`,
    }).catch(() => {});

    sendBookingUpdateNotice(updated, { changes: changeLines })
      .then((res) => {
        if (res?.ok) {
          recordBookingEvent({
            bookingId: updated.id,
            bookingCode: code,
            eventType: 'update_notified',
            summary: 'Update email sent to customer',
            actor: 'system',
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.error('[mailer] update notice failed', err);
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
      changes: changeLines,
    });
  } catch (err) {
    console.error('[admin/bookings/services] update failed', err);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}
