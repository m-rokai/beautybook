import { NextResponse } from 'next/server';
import { getTakenSlotsForDate } from '../../../../lib/bookings-db';

// GET /api/bookings/availability?date=YYYY-MM-DD
// Returns the list of taken time slot ids for the given date.
// The client combines this with its hardcoded TIME_SLOTS list to mark slots as available/booked.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date query param must be YYYY-MM-DD' },
      { status: 400 },
    );
  }

  try {
    const takenTimeIds = await getTakenSlotsForDate(date);
    return NextResponse.json({ date, takenTimeIds });
  } catch (error) {
    console.error('[api/bookings/availability] failed', error);
    return NextResponse.json(
      { error: 'Failed to load availability' },
      { status: 500 },
    );
  }
}
