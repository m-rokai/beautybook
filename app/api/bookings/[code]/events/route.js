import { NextResponse } from 'next/server';
import { listBookingEvents } from '../../../../../lib/booking-events';
import { getSession } from '../../../../../lib/auth-helpers';

// GET /api/bookings/:code/events  (admin only)
// Returns the full append-only event log for one booking, newest first.
export async function GET(_request, { params }) {
  const session = await getSession();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  try {
    const events = await listBookingEvents(code);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('[admin/bookings/events] list failed', err);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
