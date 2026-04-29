import { NextResponse } from 'next/server';
import { getBookedIntervalsForDate } from '../../../../lib/bookings-db';
import { services as catalog } from '../../../../lib/demo-data';
import {
  parseDurationMinutes,
  blockedStartSlots,
} from '../../../../lib/duration';

// Mirror of the client TIME_SLOTS list — every 30 min from 9:00 AM through 7:00 PM.
const SLOT_IDS = (() => {
  const ids = [];
  for (let h = 9; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m > 0) break;
      ids.push(`${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`);
    }
  }
  return ids;
})();

const serviceById = new Map(catalog.map((s) => [s.id, s]));

// GET /api/bookings/availability?date=YYYY-MM-DD&serviceId=customized-facial
//
// Returns the slot ids that should be blocked for the given candidate service.
// A slot s is blocked iff the candidate's interval [s, s+candidateDuration)
// overlaps any existing booking's interval.
//
// If serviceId is missing, candidate duration defaults to 30 min — which still
// correctly expands existing multi-slot bookings into every grid-slot they
// occupy (an improvement over single-id matching).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const serviceId = searchParams.get('serviceId');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date query param must be YYYY-MM-DD' },
      { status: 400 },
    );
  }

  try {
    const rows = await getBookedIntervalsForDate(date);
    const existing = rows.map((row) => {
      const svc = serviceById.get(row.serviceId);
      return {
        startId: row.timeId,
        durationMin: parseDurationMinutes(svc?.duration),
      };
    });

    const candidate = serviceId ? serviceById.get(serviceId) : null;
    const candidateDurationMin = parseDurationMinutes(candidate?.duration);

    const takenTimeIds = blockedStartSlots(SLOT_IDS, candidateDurationMin, existing);

    return NextResponse.json({
      date,
      candidateDurationMin,
      takenTimeIds,
    });
  } catch (error) {
    console.error('[api/bookings/availability] failed', error);
    return NextResponse.json(
      { error: 'Failed to load availability' },
      { status: 500 },
    );
  }
}
