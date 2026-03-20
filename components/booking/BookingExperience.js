'use client';

import { useMemo, useState } from 'react';

const initialCustomer = {
  name: '',
  email: '',
  phone: '',
  notes: '',
  paymentIntent: 'deposit',
};

export function BookingExperience({ services, slotGroups, policies }) {
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id ?? '');
  const [selectedSlotId, setSelectedSlotId] = useState(slotGroups[0]?.slots[0]?.id ?? '');
  const [customer, setCustomer] = useState(initialCustomer);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? services[0],
    [selectedServiceId, services]
  );

  const allSlots = useMemo(() => slotGroups.flatMap((group) => group.slots), [slotGroups]);
  const selectedSlot = useMemo(
    () => allSlots.find((slot) => slot.id === selectedSlotId) ?? allSlots[0],
    [allSlots, selectedSlotId]
  );

  const handleCustomerChange = (event) => {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!selectedService || !selectedSlot || !customer.name || !customer.email || !agreedToPolicy) {
      return;
    }

    setConfirmedBooking({
      code: 'MUZE-ESTH-2048',
      service: selectedService.name,
      slot: selectedSlot.label,
      date: selectedSlot.dateLabel,
      customer: customer.name,
      chargeToday: customer.paymentIntent === 'full' ? selectedService.price : selectedService.deposit,
    });
  };

  return (
    <section className="booking-grid">
      <form className="card booking-form" onSubmit={handleSubmit}>
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">1. Pick a service</span>
            <h2>Treatments</h2>
          </div>

          <div className="feature-grid">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`service-card ${selectedServiceId === service.id ? 'active' : ''}`}
                onClick={() => setSelectedServiceId(service.id)}
              >
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <div className="service-meta">
                  <span>{service.duration}</span>
                  <strong>{service.price}</strong>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">2. Choose a slot</span>
            <h2>Availability</h2>
          </div>

          {slotGroups.map((group) => (
            <div key={group.id} className="stack">
              <div>
                <h3>{group.day}</h3>
                <p className="muted">{group.caption}</p>
              </div>

              <div className="slot-grid">
                {group.slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    className={`slot-card ${selectedSlotId === slot.id ? 'active' : ''}`}
                    onClick={() => setSelectedSlotId(slot.id)}
                  >
                    <strong>{slot.label}</strong>
                    <small>{slot.status}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">3. Guest details</span>
            <h2>Checkout profile</h2>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" value={customer.name} onChange={handleCustomerChange} placeholder="Ashley Lacy" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={customer.email}
                onChange={handleCustomerChange}
                placeholder="ashley@example.com"
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" value={customer.phone} onChange={handleCustomerChange} placeholder="(555) 555-0122" />
            </div>
            <div className="field">
              <label htmlFor="paymentIntent">Charge strategy</label>
              <select id="paymentIntent" name="paymentIntent" value={customer.paymentIntent} onChange={handleCustomerChange}>
                <option value="deposit">Charge deposit now</option>
                <option value="full">Charge full service now</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">Skin goals or notes</label>
            <textarea
              id="notes"
              name="notes"
              value={customer.notes}
              onChange={handleCustomerChange}
              placeholder="Sensitive skin, preferred fragrance-free products, first-time guest, etc."
            />
          </div>
        </div>

        <div className="card accent-card">
          <div className="section-header left">
            <span className="eyebrow">Terms</span>
            <h2>Cancellation policy</h2>
          </div>
          <div className="policy-summary">
            {policies.map((policy) => (
              <div key={policy.id} className="policy-chip">
                <strong>{policy.label}</strong>
                <span>{policy.value}</span>
              </div>
            ))}
          </div>

          <label className="toggle-row">
            <input type="checkbox" checked={agreedToPolicy} onChange={() => setAgreedToPolicy((value) => !value)} />
            <span>I agree to the booking and cancellation terms and authorize Stripe to charge any applicable fees.</span>
          </label>
        </div>

        <div className="action-row">
          <button className="button button-primary" type="submit">
            Confirm booking
          </button>
          <span className="muted">Next step: create a Stripe Checkout Session and save the booking in Supabase.</span>
        </div>

        {confirmedBooking ? (
          <div className="success-banner">
            <strong>Booking staged successfully.</strong>
            <p>
              {confirmedBooking.customer} is set for {confirmedBooking.service} on {confirmedBooking.date} at{' '}
              {confirmedBooking.slot}. Reference code: {confirmedBooking.code}. Charge today: {confirmedBooking.chargeToday}.
            </p>
          </div>
        ) : null}
      </form>

      <aside className="card summary-card">
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">Appointment summary</span>
            <h2>{selectedService?.name ?? 'Pick a service'}</h2>
          </div>

          <div className="summary-price">
            <span>{selectedService?.duration}</span>
            <strong>{selectedService?.price}</strong>
          </div>

          <div className="timeline">
            <div className="timeline-item">
              <small>Date</small>
              <strong>{selectedSlot?.dateLabel}</strong>
            </div>
            <div className="timeline-item">
              <small>Time</small>
              <strong>{selectedSlot?.label}</strong>
            </div>
            <div className="timeline-item">
              <small>Deposit due today</small>
              <strong>{selectedService?.deposit}</strong>
            </div>
            <div className="timeline-item">
              <small>Late cancellation fee</small>
              <strong>{selectedService?.cancellationFee}</strong>
            </div>
          </div>

          <ul className="list-tight">
            <li>Store guest, appointment, and service records in Supabase.</li>
            <li>Send confirmation, reminder, and follow-up email via Resend.</li>
            <li>Use Stripe metadata to support cancellation fees and no-show terms.</li>
          </ul>
        </div>
      </aside>
    </section>
  );
}
