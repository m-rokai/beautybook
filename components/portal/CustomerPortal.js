'use client';

import { useMemo, useState } from 'react';

export function CustomerPortal({ appointments, slotGroups, policies }) {
  const [bookingCode, setBookingCode] = useState('MUZE-ESTH-2048');
  const [appointmentState, setAppointmentState] = useState(appointments);

  const allSlots = useMemo(() => slotGroups.flatMap((group) => group.slots), [slotGroups]);
  const matchedAppointment = appointmentState.find((appointment) => appointment.code === bookingCode.trim());

  const reschedule = (slotId) => {
    const slot = allSlots.find((entry) => entry.id === slotId);
    if (!slot || !matchedAppointment) return;

    setAppointmentState((current) =>
      current.map((appointment) =>
        appointment.code === bookingCode.trim()
          ? { ...appointment, date: slot.dateLabel, time: slot.label, status: 'Rescheduled' }
          : appointment
      )
    );
  };

  const cancelAppointment = () => {
    if (!matchedAppointment) return;

    setAppointmentState((current) =>
      current.map((appointment) =>
        appointment.code === bookingCode.trim()
          ? { ...appointment, status: 'Cancelled', feeNotice: 'Late cancellation fee applies: $35' }
          : appointment
      )
    );
  };

  return (
    <section className="portal-grid">
      <div className="card portal-column">
        <div className="section-header left">
          <span className="eyebrow">Lookup</span>
          <h2>Manage your appointment</h2>
        </div>

        <div className="field">
          <label htmlFor="bookingCode">Booking code</label>
          <input
            id="bookingCode"
            value={bookingCode}
            onChange={(event) => setBookingCode(event.target.value)}
            placeholder="Enter booking reference"
          />
        </div>

        {matchedAppointment ? (
          <div className="stack">
            <div className="note-card">
              <div className="appointment-meta">
                <div>
                  <strong>{matchedAppointment.service}</strong>
                  <p>{matchedAppointment.provider}</p>
                </div>
                <span className={`status-pill ${matchedAppointment.status === 'Cancelled' ? 'warning' : 'gold'}`}>
                  {matchedAppointment.status}
                </span>
              </div>
              <ul className="list-tight">
                <li>Date: {matchedAppointment.date}</li>
                <li>Time: {matchedAppointment.time}</li>
                <li>Guest: {matchedAppointment.customer}</li>
                <li>Payment status: {matchedAppointment.paymentStatus}</li>
              </ul>
              {matchedAppointment.feeNotice ? <p>{matchedAppointment.feeNotice}</p> : null}
            </div>

            <div className="stack">
              <h3>Pick a new slot</h3>
              <div className="slot-grid">
                {allSlots.slice(0, 6).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className="chip-button"
                    onClick={() => reschedule(slot.id)}
                  >
                    <strong>{slot.label}</strong>
                    <small>{slot.dateLabel}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="action-row">
              <button className="button button-primary" type="button" onClick={cancelAppointment}>
                Cancel appointment
              </button>
              <span className="muted">Stripe metadata can drive fee collection when cancellation terms are breached.</span>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            Enter a valid booking code to reschedule or cancel an appointment.
          </div>
        )}
      </div>

      <aside className="card portal-column">
        <div className="section-header left">
          <span className="eyebrow">Policy reminder</span>
          <h2>Before a guest changes plans</h2>
        </div>

        <div className="policy-summary">
          {policies.map((policy) => (
            <div key={policy.id} className="policy-chip">
              <strong>{policy.label}</strong>
              <span>{policy.value}</span>
            </div>
          ))}
        </div>

        <div className="stack">
          <h3>Guest communications</h3>
          <ul className="list-tight">
            <li>Send confirmation and reminder emails via Resend.</li>
            <li>Update the appointment record in Supabase after each customer action.</li>
            <li>Issue fee charges or refunds through Stripe depending on timing and policy.</li>
          </ul>
        </div>
      </aside>
    </section>
  );
}
