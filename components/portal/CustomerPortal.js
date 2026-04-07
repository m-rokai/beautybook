'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  fetchBooking,
  patchBooking,
  fetchTakenSlotsForDate,
  getAvailableDates,
  getBaseTimeSlots,
  formatDateKey,
  formatDateLabel,
} from '../../lib/booking-store';

const formatDollars = (cents) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
};

export function CustomerPortal({ policies }) {
  const [bookingCode, setBookingCode] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  // reschedule calendar state
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTimeId, setSelectedTimeId] = useState('');

  useEffect(() => {
    setDates(getAvailableDates(14));
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    (async () => {
      try {
        const takenIds = await fetchTakenSlotsForDate(formatDateKey(selectedDate));
        if (cancelled) return;
        const slots = getBaseTimeSlots().map((slot) => ({
          ...slot,
          available: !takenIds.includes(slot.id),
        }));
        setTimeSlots(slots);
        const firstAvailable = slots.find((s) => s.available);
        setSelectedTimeId(firstAvailable?.id ?? '');
      } catch (error) {
        console.error('[portal] availability fetch failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const handleLookup = async () => {
    const code = bookingCode.trim();
    if (!code) return;

    setIsLoading(true);
    setLookupError('');
    try {
      const found = await fetchBooking(code);
      setAppointment(found);
      if (!found) setLookupError(`No booking found for "${code}".`);
    } catch (error) {
      console.error('[portal] lookup failed', error);
      setLookupError(error?.message || 'Lookup failed.');
      setAppointment(null);
    } finally {
      setLookupDone(true);
      setShowReschedule(false);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup();
    }
  };

  const handleReschedule = async () => {
    if (!appointment || !selectedDate || !selectedTimeId) return;
    const slot = timeSlots.find((s) => s.id === selectedTimeId);
    if (!slot) return;

    try {
      const updated = await patchBooking(appointment.code, {
        scheduledDate: formatDateKey(selectedDate),
        scheduledTimeId: slot.id,
        scheduledTimeLabel: slot.label,
        status: 'rescheduled',
      });
      setAppointment(updated);
      setShowReschedule(false);
    } catch (error) {
      console.error('[portal] reschedule failed', error);
      setLookupError(error?.message || 'Could not reschedule.');
    }
  };

  const handleCancel = async () => {
    if (!appointment) return;
    try {
      const updated = await patchBooking(appointment.code, { status: 'cancelled' });
      setAppointment(updated);
    } catch (error) {
      console.error('[portal] cancel failed', error);
      setLookupError(error?.message || 'Could not cancel.');
    }
  };

  const statusClass =
    appointment?.status === 'cancelled'
      ? 'warning'
      : appointment?.status === 'confirmed'
      ? 'success'
      : 'gold';

  return (
    <section className="portal-grid">
      <div className="card portal-column">
        <div className="section-header left">
          <span className="eyebrow">Look up</span>
          <h2>Find Your Appointment</h2>
        </div>

        <div className="field">
          <label htmlFor="bookingCode">Booking code</label>
          <input
            id="bookingCode"
            value={bookingCode}
            onChange={(e) => setBookingCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. AL-AB3C9"
          />
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={handleLookup}
          disabled={isLoading}
        >
          {isLoading ? 'Looking up…' : 'Look Up Booking'}
        </button>

        {lookupDone && lookupError && (
          <div className="empty-state">{lookupError}</div>
        )}

        {appointment && (
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="note-card">
              <div className="appointment-meta">
                <div>
                  <strong>{appointment.serviceName}</strong>
                  <p>{appointment.customerName}</p>
                </div>
                <span className={`status-pill ${statusClass}`}>
                  {appointment.status}
                </span>
              </div>
              <ul className="list-tight" style={{ marginTop: 12 }}>
                <li>Date: {appointment.scheduledDate}</li>
                <li>Time: {appointment.scheduledTimeLabel}</li>
                <li>Email: {appointment.customerEmail}</li>
                <li>
                  Payment:{' '}
                  {appointment.paymentIntent === 'full'
                    ? 'Paid in full'
                    : 'Deposit captured'}{' '}
                  ({formatDollars(appointment.depositCents)})
                </li>
                {appointment.remainingCents > 0 && appointment.balanceStatus !== 'paid' && (
                  <li>
                    Balance owed: {formatDollars(appointment.remainingCents)}
                    {appointment.balanceLinkUrl && (
                      <>
                        {' — '}
                        <a href={appointment.balanceLinkUrl} target="_blank" rel="noreferrer">
                          pay now
                        </a>
                      </>
                    )}
                  </li>
                )}
              </ul>
            </div>

            {appointment.status !== 'cancelled' && (
              <>
                {!showReschedule ? (
                  <div className="action-row">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setShowReschedule(true);
                        if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
                      }}
                    >
                      Reschedule
                    </button>
                    <button type="button" className="button button-danger" onClick={handleCancel}>
                      Cancel Appointment
                    </button>
                  </div>
                ) : (
                  <div className="stack">
                    <h3>Pick a new date & time</h3>

                    <div className="date-strip">
                      {dates.map((date) => {
                        const key = formatDateKey(date);
                        const isActive = selectedDate && formatDateKey(selectedDate) === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`date-card ${isActive ? 'active' : ''}`}
                            onClick={() => setSelectedDate(date)}
                          >
                            <span className="date-day">{format(date, 'EEE')}</span>
                            <span className="date-num">{format(date, 'd')}</span>
                            <span className="date-month">{format(date, 'MMM')}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedDate && (
                      <div className="time-grid">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={!slot.available}
                            className={`slot-card ${selectedTimeId === slot.id ? 'active' : ''} ${!slot.available ? 'booked' : ''}`}
                            onClick={() => slot.available && setSelectedTimeId(slot.id)}
                          >
                            <strong>{slot.label}</strong>
                            <small>{slot.available ? 'Available' : 'Booked'}</small>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="action-row">
                      <button type="button" className="button button-primary" onClick={handleReschedule}>
                        Confirm Reschedule
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setShowReschedule(false)}
                      >
                        Never mind
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <aside className="card portal-column">
        <div className="section-header left">
          <span className="eyebrow">Policies</span>
          <h2>Before You Make Changes</h2>
        </div>

        <div className="policy-summary">
          {policies.map((policy) => (
            <div key={policy.id} className="policy-chip">
              <strong>{policy.label}</strong>
              <span>{policy.value}</span>
            </div>
          ))}
        </div>

        <div className="note-card" style={{ marginTop: 8 }}>
          <strong>Lost your code?</strong>
          <p>It's on the confirmation shown after booking — starts with AL-. If you can't find it, reach out and we'll look it up.</p>
        </div>
      </aside>
    </section>
  );
}
