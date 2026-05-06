import { format, addDays } from 'date-fns';

/**
 * Thin client-side wrapper around the booking API. Pure date/time helpers stay
 * local; anything that touches state goes through fetch.
 *
 * All functions that touch data are async and return the booking shape the API
 * returns (snake_case columns translated to camelCase by Drizzle).
 */

// ── calendar helpers (pure) ──

// Open every day of the week.
const BUSINESS_DAYS = [0, 1, 2, 3, 4, 5, 6];

// 30-min granularity, 9:00 AM through 7:00 PM (last start). Period field powers
// the Morning / Afternoon / Evening grouping in the UI.
const TIME_SLOTS = (() => {
  const slots = [];
  for (let hour = 9; hour <= 19; hour++) {
    for (const minute of [0, 30]) {
      // Stop after 7:00 PM start.
      if (hour === 19 && minute > 0) break;
      const id = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
      const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      const display = hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const label = `${display}:${String(minute).padStart(2, '0')} ${ampm}`;
      slots.push({ id, label, period });
    }
  }
  return slots;
})();

export function getAvailableDates(count = 14) {
  const dates = [];
  let cursor = new Date();
  while (dates.length < count) {
    cursor = addDays(cursor, 1);
    if (BUSINESS_DAYS.includes(cursor.getDay())) {
      dates.push(new Date(cursor));
    }
  }
  return dates;
}

export function formatDateLabel(date) {
  return format(date, 'EEEE, MMMM d');
}

export function formatDateShort(date) {
  return format(date, 'MMM d');
}

export function formatDateKey(date) {
  return format(date, 'yyyy-MM-dd');
}

/** Base time slot list. Combine with `fetchTakenSlotsForDate` to mark availability. */
export function getBaseTimeSlots() {
  return TIME_SLOTS.map((slot) => ({ ...slot }));
}

// ── fetch wrappers ──

async function handleJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return payload;
}

/** Admin: list every booking. */
export async function fetchBookings() {
  const res = await fetch('/api/bookings', { cache: 'no-store' });
  const data = await handleJson(res);
  return data.bookings || [];
}

/** Portal/admin: look up one booking by its code. Returns null on 404. */
export async function fetchBooking(code) {
  const res = await fetch(`/api/bookings/${encodeURIComponent(code.trim())}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  const data = await handleJson(res);
  return data.booking;
}

/** Admin: cancel a booking and (by default) refund the deposit through Square. */
export async function cancelBooking(code, { refund = 'deposit' } = {}) {
  const res = await fetch(`/api/bookings/${encodeURIComponent(code)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refund }),
  });
  const data = await handleJson(res);
  return data; // { booking, refundedCents }
}

/** Partial update: status, reschedule fields, balanceStatus, etc. */
export async function patchBooking(code, patch) {
  const res = await fetch(`/api/bookings/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await handleJson(res);
  return data.booking;
}

/** Fetch the taken time-slot ids for a date. Pass serviceId so the API can
 *  block slots where the candidate service would overlap existing bookings. */
export async function fetchTakenSlotsForDate(dateKey, serviceId) {
  const params = new URLSearchParams({ date: dateKey });
  if (serviceId) params.set('serviceId', serviceId);
  const res = await fetch(`/api/bookings/availability?${params.toString()}`, {
    cache: 'no-store',
  });
  const data = await handleJson(res);
  return data.takenTimeIds || [];
}

/** Trigger the admin "collect balance" action for a booking. Returns the updated booking. */
export async function requestBalanceLink(code) {
  const res = await fetch('/api/bookings/collect-balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingCode: code }),
  });
  const data = await handleJson(res);
  return data.booking;
}
