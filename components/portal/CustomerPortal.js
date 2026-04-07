'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  findBooking,
  updateBooking,
  getAvailableDates,
  getTimeSlotsForDate,
  formatDateKey,
  formatDateLabel,
  seedIfEmpty,
} from '../../lib/booking-store';

export function CustomerPortal({ policies }) {
  const [bookingCode, setBookingCode] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  // reschedule calendar state
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTimeId, setSelectedTimeId] = useState('');

  useEffect(() => {
    seedIfEmpty();
    const available = getAvailableDates(14);
    setDates(available);
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const slots = getTimeSlotsForDate(formatDateKey(selectedDate));
    setTimeSlots(slots);
    const firstAvailable = slots.find((s) => s.available);
    setSelectedTimeId(firstAvailable?.id ?? '');
  }, [selectedDate]);

  const handleLookup = () => {
    const found = findBooking(bookingCode);
    setAppointment(found || null);
    setLookupDone(true);
    setShowReschedule(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup();
    }
  };

  const handleReschedule = () => {
    if (!appointment || !selectedDate || !selectedTimeId) return;
    const slot = timeSlots.find((s) => s.id === selectedTimeId);
    if (!slot) return;

    const updated = updateBooking(appointment.code, {
      date: formatDateKey(selectedDate),
      dateLabel: formatDateLabel(selectedDate),
      timeId: slot.id,
      timeLabel: slot.label,
      status: 'rescheduled',
    });

    setAppointment(updated);
    setShowReschedule(false);
  };

  const handleCancel = () => {
    if (!appointment) return;

    const updated = updateBooking(appointment.code, {
      status: 'cancelled',
      feeNotice: 'Late cancellation fee may apply — see policy.',
    });

    setAppointment(updated);
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
            placeholder="e.g. AL-SAMPLE1"
          />
        </div>

        <button type="button" className="button button-primary" onClick={handleLookup}>
          Look Up Booking
        </button>

        {lookupDone && !appointment && (
          <div className="empty-state">
            No booking found for "{bookingCode}". Double-check your code and try again.
          </div>
        )}

        {appointment && (
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="note-card">
              <div className="appointment-meta">
                <div>
                  <strong>{appointment.service}</strong>
                  <p>{appointment.customer}</p>
                </div>
                <span className={`status-pill ${statusClass}`}>
                  {appointment.status}
                </span>
              </div>
              <ul className="list-tight" style={{ marginTop: 12 }}>
                <li>Date: {appointment.dateLabel}</li>
                <li>Time: {appointment.timeLabel}</li>
                <li>Email: {appointment.email}</li>
                <li>Payment: {appointment.paymentIntent === 'full' ? 'Paid in full' : 'Deposit captured'} ({appointment.chargeToday})</li>
              </ul>
              {appointment.feeNotice && (
                <p style={{ marginTop: 12, color: 'var(--warning)', fontWeight: 500, fontSize: '0.9rem' }}>
                  {appointment.feeNotice}
                </p>
              )}
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
                      <button type="button" className="button button-secondary" onClick={() => setShowReschedule(false)}>
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
          <strong>Sample codes to try</strong>
          <p>
            AL-SAMPLE1, AL-SAMPLE2, AL-SAMPLE3 — or book an appointment to get your own code.
          </p>
        </div>
      </aside>
    </section>
  );
}
