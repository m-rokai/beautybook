import { NextResponse } from 'next/server';
import { findBookingByCode, updateBookingByCode } from '../../../../lib/bookings-db';
import { getSession } from '../../../../lib/auth-helpers';

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

// PATCH /api/bookings/:code — used by BOTH admin and the customer portal.
// The customer portal is authorized by knowledge of the booking code;
// admins are authorized by their session. Non-admins get a narrower field
// allowlist and can only flip status to 'cancelled' or 'rescheduled'.
const ADMIN_WRITABLE_FIELDS = new Set([
  'status',
  'scheduledDate',
  'scheduledTimeId',
  'scheduledTimeLabel',
  'balanceStatus',
  'customerNotes',
]);

const CUSTOMER_WRITABLE_FIELDS = new Set([
  'status',
  'scheduledDate',
  'scheduledTimeId',
  'scheduledTimeLabel',
  'customerNotes',
]);

const CUSTOMER_ALLOWED_STATUSES = new Set(['cancelled', 'rescheduled']);

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

  const session = await getSession();
  const isAdmin = Boolean(session?.user?.isAdmin);
  const allowed = isAdmin ? ADMIN_WRITABLE_FIELDS : CUSTOMER_WRITABLE_FIELDS;

  const patch = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (allowed.has(key)) patch[key] = value;
  }

  if (!isAdmin && patch.status !== undefined && !CUSTOMER_ALLOWED_STATUSES.has(patch.status)) {
    return NextResponse.json(
      { error: 'Status change not permitted' },
      { status: 403 },
    );
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
