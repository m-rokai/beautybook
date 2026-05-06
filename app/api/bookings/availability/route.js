import { NextResponse } from 'next/server';
import { getBookedIntervalsForDate } from '../../../../lib/bookings-db';
import { getServiceMap } from '../../../../lib/services-db';
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

// GET /api/bookings/availability?date=YYYY-MM-DD&serviceIds=a,b,c
//   (legacy: ?serviceId=a — kept for any callers still on the single-select API)
//
// Returns the slot ids that should be blocked for the candidate booking. A
// slot s is blocked iff the candidate's interval [s, s+candidateDuration)
// overlaps any existing booking's interval. candidateDuration is the SUM of
// the durations of every service the customer has selected — back-to-back
// execution is the default and matches Ashley's solo-practitioner model.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const serviceIdsParam = searchParams.get('serviceIds');
  const candidateIds = serviceIdsParam
    ? serviceIdsParam.split(',').filter(Boolean)
    : searchParams.get('serviceId')
      ? [searchParams.get('serviceId')]
      : [];

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date query param must be YYYY-MM-DD' },
      { status: 400 },
    );
  }

  try {
    // Fetch the catalog from the DB so admin edits to durations land in
    // conflict-detection on the very next request.
    const serviceById = await getServiceMap();
    const rows = await getBookedIntervalsForDate(date);
    const existing = rows.map((row) => {
      // Use full service_ids array when present; fall back to the primary
      // serviceId for legacy single-service rows that pre-date 0003.
      const ids = Array.isArray(row.serviceIds) && row.serviceIds.length > 0
        ? row.serviceIds
        : [row.serviceId];
      const durationMin = ids.reduce(
        (sum, id) => sum + parseDurationMinutes(serviceById.get(id)?.duration),
        0,
      );
      return { startId: row.timeId, durationMin };
    });

    // Sum durations across every selected service. Empty selection falls
    // back to a 30-min minimum so we still expand existing multi-slot rows.
    const candidateDurationMin =
      candidateIds.length > 0
        ? candidateIds.reduce(
            (sum, id) => sum + parseDurationMinutes(serviceById.get(id)?.duration),
            0,
          )
        : parseDurationMinutes(undefined);

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
