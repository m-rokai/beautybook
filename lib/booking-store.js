import { format, addDays, isAfter, startOfDay } from 'date-fns';

const STORAGE_KEY = 'al-aesthetics-bookings';

// ── helpers ──

export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AL-';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── CRUD ──

export function getBookings() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveBooking(booking) {
  const bookings = getBookings();
  bookings.push(booking);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  return booking;
}

export function updateBooking(code, updates) {
  const bookings = getBookings();
  const updated = bookings.map((b) =>
    b.code === code ? { ...b, ...updates } : b
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated.find((b) => b.code === code);
}

export function findBooking(code) {
  return getBookings().find((b) => b.code === code.trim());
}

// ── calendar ──

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

export function getTimeSlotsForDate(dateStr) {
  const bookings = getBookings();
  const bookedTimes = bookings
    .filter((b) => b.date === dateStr && b.status !== 'cancelled')
    .map((b) => b.timeId);

  return TIME_SLOTS.map((slot) => ({
    ...slot,
    available: !bookedTimes.includes(slot.id),
  }));
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

// ── seed data ──

export function seedIfEmpty() {
  if (typeof window === 'undefined') return;
  const existing = getBookings();
  if (existing.length > 0) return;

  const dates = getAvailableDates(6);

  const seeds = [
    {
      code: 'AL-SAMPLE1',
      service: 'Customized Facial',
      serviceId: 'customized-facial',
      price: '$75',
      deposit: '$25',
      addOns: ['HydroJelly Mask'],
      date: formatDateKey(dates[0]),
      dateLabel: formatDateLabel(dates[0]),
      timeId: '1030',
      timeLabel: '10:30 AM',
      customer: 'Ashley Lacy',
      email: 'ashley@example.com',
      phone: '(555) 234-5678',
      status: 'confirmed',
      paymentIntent: 'deposit',
      chargeToday: '$25',
      createdAt: new Date().toISOString(),
    },
    {
      code: 'AL-SAMPLE2',
      service: 'Brazilian w/ Bum Wax',
      serviceId: 'brazilian-bum',
      price: '$75',
      deposit: '$25',
      addOns: [],
      date: formatDateKey(dates[1]),
      dateLabel: formatDateLabel(dates[1]),
      timeId: '1200',
      timeLabel: '12:00 PM',
      customer: 'Jaz Monroe',
      email: 'jaz@example.com',
      phone: '(555) 876-5432',
      status: 'pending',
      paymentIntent: 'deposit',
      chargeToday: '$25',
      createdAt: new Date().toISOString(),
    },
    {
      code: 'AL-SAMPLE3',
      service: 'Express Facial',
      serviceId: 'express-facial',
      price: '$50',
      deposit: '$20',
      addOns: ['Plant Peel'],
      date: formatDateKey(dates[2]),
      dateLabel: formatDateLabel(dates[2]),
      timeId: '1500',
      timeLabel: '3:00 PM',
      customer: 'Leah Warren',
      email: 'leah@example.com',
      phone: '(555) 345-6789',
      status: 'confirmed',
      paymentIntent: 'full',
      chargeToday: '$50',
      createdAt: new Date().toISOString(),
    },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
}
