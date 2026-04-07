import { format, addDays } from 'date-fns';

/**
 * Thin client-side wrapper around the booking API. Pure date/time helpers stay
 * local; anything that touches state goes through fetch.
 *
 * All functions that touch data are async and return the booking shape the API
 * returns (snake_case columns translated to camelCase by Drizzle).
 */

// ── calendar helpers (pure) ──

const BUSINESS_DAYS = [2, 3, 4, 5, 6]; // Tue–Sat

const TIME_SLOTS = [
  { id: '0900', label: '9:00 AM' },
  { id: '1030', label: '10:30 AM' },
  { id: '1200', label: '12:00 PM' },
  { id: '1330', label: '1:30 PM' },
  { id: '1500', label: '3:00 PM' },
  { id: '1630', label: '4:30 PM' },
];

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

/** Fetch the taken time-slot ids for a date. Combine with getBaseTimeSlots(). */
export async function fetchTakenSlotsForDate(dateKey) {
  const res = await fetch(
    `/api/bookings/availability?date=${encodeURIComponent(dateKey)}`,
    { cache: 'no-store' },
  );
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
