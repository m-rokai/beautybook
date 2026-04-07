import { NextResponse } from 'next/server';
import { findBookingByCode, updateBookingByCode } from '../../../../lib/bookings-db';

// GET /api/bookings/:code — used by the customer portal and admin.
export async function GET(_request, { params }) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }
  try {
    const booking = await findBookingByCode(code);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ booking });
  } catch (error) {
    console.error('[api/bookings/:code] find failed', error);
    return NextResponse.json({ error: 'Failed to load booking' }, { status: 500 });
  }
}

// PATCH /api/bookings/:code — update status, reschedule, cancel, mark balance paid, etc.
// Only a whitelist of fields is writable.
const WRITABLE_FIELDS = new Set([
  'status',
  'scheduledDate',
  'scheduledTimeId',
  'scheduledTimeLabel',
  'balanceStatus',
  'customerNotes',
]);

export async function PATCH(request, { params }) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const patch = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (WRITABLE_FIELDS.has(key)) patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No writable fields in body' }, { status: 400 });
  }

  try {
    const updated = await updateBookingByCode(code, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    return NextResponse.json({ booking: updated });
  } catch (error) {
    console.error('[api/bookings/:code] update failed', error);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}
