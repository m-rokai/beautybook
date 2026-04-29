import { NextResponse } from 'next/server';
import { listBookings } from '../../../lib/bookings-db';
import { requireAdmin } from '../../../lib/auth-helpers';

// GET /api/bookings — admin-only: list all bookings for the dashboard.
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const rows = await listBookings();
    return NextResponse.json({ bookings: rows });
  } catch (error) {
    console.error('[api/bookings] list failed', error);
    return NextResponse.json({ error: 'Failed to list bookings' }, { status: 500 });
  }
}
