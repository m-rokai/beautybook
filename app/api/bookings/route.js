import { NextResponse } from 'next/server';
import { listBookings } from '../../../lib/bookings-db';

// GET /api/bookings — list all bookings for the admin dashboard.
// TODO: require auth (Clerk/Auth.js) once an admin login exists.
export async function GET() {
  try {
    const rows = await listBookings();
    return NextResponse.json({ bookings: rows });
  } catch (error) {
    console.error('[api/bookings] list failed', error);
    return NextResponse.json({ error: 'Failed to list bookings' }, { status: 500 });
  }
}
