// Pure helpers for time-slot arithmetic. Used both server-side (availability
// API) and would be safe in client code if needed.

const SLOT_STEP_MIN = 30;

/**
 * Parse a duration string like "30 min", "1 hr", or "1 hr 15 min" into minutes.
 * Falls back to 30 if the input is missing or unparseable so callers never get NaN.
 */
export function parseDurationMinutes(durationStr) {
  if (!durationStr) return SLOT_STEP_MIN;
  let mins = 0;
  const hr = String(durationStr).match(/(\d+)\s*hr/i);
  const m = String(durationStr).match(/(\d+)\s*min/i);
  if (hr) mins += parseInt(hr[1], 10) * 60;
  if (m) mins += parseInt(m[1], 10);
  return mins > 0 ? mins : SLOT_STEP_MIN;
}

/** "1030" → 630 minutes since midnight. */
export function slotIdToMinutes(id) {
  if (!id || id.length !== 4) return null;
  const h = parseInt(id.slice(0, 2), 10);
  const m = parseInt(id.slice(2, 4), 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** 630 → "1030". */
export function minutesToSlotId(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

/**
 * Half-open interval overlap check: do [aStart, aEnd) and [bStart, bEnd)
 * intersect? End == start does NOT overlap (back-to-back is fine).
 */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Given an existing booking's start (slotId) and duration (minutes), return
 * every grid-aligned slot id it OCCUPIES on the 30-min grid.
 *
 * Example: start=1000, duration=90 → ['1000', '1030', '1100']
 */
export function slotIdsOccupiedBy(startId, durationMin) {
  const start = slotIdToMinutes(startId);
  if (start == null) return [];
  const ids = [];
  for (let m = start; m < start + durationMin; m += SLOT_STEP_MIN) {
    ids.push(minutesToSlotId(m));
  }
  return ids;
}

/**
 * Given the list of existing booking intervals and a candidate service duration,
 * return the set of slot ids that should be blocked. A candidate slot s is
 * blocked iff [s, s+candidateDuration) overlaps any existing interval.
 *
 * `slotIds` is the full list of bookable starts (the client's TIME_SLOTS),
 * `existing` is `[{ startId, durationMin }, ...]`.
 */
export function blockedStartSlots(slotIds, candidateDurationMin, existing) {
  const intervals = existing
    .map((b) => {
      const start = slotIdToMinutes(b.startId);
      if (start == null) return null;
      return [start, start + (b.durationMin || SLOT_STEP_MIN)];
    })
    .filter(Boolean);

  const blocked = new Set();
  for (const id of slotIds) {
    const start = slotIdToMinutes(id);
    if (start == null) continue;
    const end = start + (candidateDurationMin || SLOT_STEP_MIN);
    for (const [bStart, bEnd] of intervals) {
      if (intervalsOverlap(start, end, bStart, bEnd)) {
        blocked.add(id);
        break;
      }
    }
  }
  return Array.from(blocked);
}
