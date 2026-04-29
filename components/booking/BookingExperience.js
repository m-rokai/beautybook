'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  getAvailableDates,
  getBaseTimeSlots,
  fetchTakenSlotsForDate,
  formatDateKey,
  formatDateLabel,
} from '../../lib/booking-store';

const initialCustomer = {
  name: '',
  email: '',
  phone: '',
  notes: '',
  paymentIntent: 'deposit',
};

// Tracks whether a horizontally-scrollable element is overflowing and which
// edge the user is touching, so a wrapper can show fade gradients + a swipe
// hint exactly when there's more content to reveal.
function useScrollEdges() {
  const ref = useRef(null);
  const [edges, setEdges] = useState({
    overflows: false,
    atStart: true,
    atEnd: false,
    scrolled: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const overflows = scrollWidth > clientWidth + 1;
      const atStart = scrollLeft <= 1;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
      setEdges((prev) => ({
        overflows,
        atStart,
        atEnd,
        scrolled: prev.scrolled || scrollLeft > 4,
      }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  return [ref, edges];
}

function ScrollShroud({ edges, children, hintLabel = 'More' }) {
  const showHint = edges.overflows && !edges.scrolled && !edges.atEnd;
  return (
    <div
      className="scroll-shroud"
      data-overflows={edges.overflows ? '1' : '0'}
      data-at-start={edges.atStart ? '1' : '0'}
      data-at-end={edges.atEnd ? '1' : '0'}
      data-hint={showHint ? '1' : '0'}
    >
      {children}
      <span className="scroll-shroud-hint" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </span>
      <span className="visually-hidden" role="status">
        {edges.overflows ? `Scroll horizontally for more ${hintLabel.toLowerCase()}.` : ''}
      </span>
    </div>
  );
}

export function BookingExperience({ serviceCategories, addOns, policies }) {
  const [tabsRef, tabsEdges] = useScrollEdges();
  const [datesRef, datesEdges] = useScrollEdges();

  const [activeCategoryId, setActiveCategoryId] = useState(serviceCategories[0]?.id ?? '');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedAddOns, setSelectedAddOns] = useState([]);

  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedTimeId, setSelectedTimeId] = useState('');

  const [customer, setCustomer] = useState(initialCustomer);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Square Web Payments SDK state
  const cardRef = useRef(null);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const activeCategory = useMemo(
    () => serviceCategories.find((c) => c.id === activeCategoryId),
    [activeCategoryId, serviceCategories]
  );

  const allServices = useMemo(
    () => serviceCategories.flatMap((c) => c.services),
    [serviceCategories]
  );

  const selectedService = useMemo(
    () => allServices.find((s) => s.id === selectedServiceId),
    [allServices, selectedServiceId]
  );

  const selectedAddOnItems = useMemo(
    () => addOns.filter((a) => selectedAddOns.includes(a.id)),
    [addOns, selectedAddOns]
  );

  const totalPrice = useMemo(() => {
    const servicePrice = selectedService?.priceNum ?? 0;
    const addOnTotal = selectedAddOnItems.reduce((sum, a) => sum + a.priceNum, 0);
    return servicePrice + addOnTotal;
  }, [selectedService, selectedAddOnItems]);

  // Parse "$25" → 25. Service deposits are strings in demo-data.
  const parseMoney = (str) => {
    const n = parseInt(String(str || '').replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  };

  const depositDollars = selectedService ? parseMoney(selectedService.deposit) : 0;
  const chargeDollars = customer.paymentIntent === 'full' ? totalPrice : depositDollars;
  const chargeCents = chargeDollars * 100;

  useEffect(() => {
    const available = getAvailableDates(14);
    setDates(available);
    if (available.length > 0) setSelectedDate(available[0]);
  }, []);

  // Fetch taken slots for the selected date and compute availability.
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
        console.error('[booking] availability fetch failed', error);
        // Fall back to assuming all slots are available so the UI doesn't lock up.
        const slots = getBaseTimeSlots().map((s) => ({ ...s, available: true }));
        setTimeSlots(slots);
        setSelectedTimeId(slots[0]?.id ?? '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // auto-select first service when switching category
  useEffect(() => {
    if (activeCategory?.services.length > 0) {
      setSelectedServiceId(activeCategory.services[0].id);
    }
  }, [activeCategoryId, activeCategory]);

  // Load Square Web Payments SDK and mount the card form
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

    if (!appId || !locationId) {
      setPaymentError('Square is not configured. Set NEXT_PUBLIC_SQUARE_APPLICATION_ID and NEXT_PUBLIC_SQUARE_LOCATION_ID in .env.local.');
      return;
    }

    let cancelled = false;

    const loadScript = () =>
      new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return reject(new Error('no window'));
        if (window.Square) return resolve();
        const existing = document.querySelector('script[data-square-sdk]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Square SDK failed to load')));
          return;
        }
        const script = document.createElement('script');
        // Square serves two CDNs: sandbox and production. The app ID prefix tells us which to load.
        const isSandbox = appId.startsWith('sandbox-');
        script.src = isSandbox
          ? 'https://sandbox.web.squarecdn.com/v1/square.js'
          : 'https://web.squarecdn.com/v1/square.js';
        script.async = true;
        script.dataset.squareSdk = 'true';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Square SDK failed to load'));
        document.head.appendChild(script);
      });

    (async () => {
      try {
        await loadScript();
        if (cancelled) return;
        const payments = window.Square.payments(appId, locationId);
        const card = await payments.card();
        if (cancelled) {
          await card.destroy?.();
          return;
        }
        await card.attach('#al-card-container');
        cardRef.current = card;
        setPaymentReady(true);
        setPaymentError('');
      } catch (error) {
        console.error('[square] init failed', error);
        setPaymentError(error?.message || 'Could not initialize card form.');
      }
    })();

    return () => {
      cancelled = true;
      if (cardRef.current) {
        cardRef.current.destroy?.().catch(() => {});
        cardRef.current = null;
      }
    };
  }, []);

  const toggleAddOn = (id) => {
    setSelectedAddOns((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id]
    );
  };

  const handleCustomerChange = (event) => {
    const { name, value } = event.target;
    setCustomer((c) => ({ ...c, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setPaymentError('');

    if (!selectedService || !selectedDate || !selectedTimeId || !customer.name || !customer.email || !agreedToPolicy) return;
    if (!cardRef.current) {
      setPaymentError('Card form is not ready yet.');
      return;
    }
    if (chargeCents <= 0) {
      setPaymentError('Invalid charge amount.');
      return;
    }

    const slot = timeSlots.find((s) => s.id === selectedTimeId);
    if (!slot) return;

    setIsProcessing(true);

    try {
      // 1. Tokenize the card with Square
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== 'OK') {
        const detail =
          tokenResult.errors?.map((e) => e.message).join(', ') ||
          'Card could not be validated.';
        throw new Error(detail);
      }

      // 2. Charge + persist atomically via our server route. The server generates
      //    the booking code, charges Square, then inserts the booking row.
      const totalCents = totalPrice * 100;
      const depositCents = chargeCents;
      const remainingCents = Math.max(0, totalCents - depositCents);

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          booking: {
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            addOnNames: selectedAddOnItems.map((a) => a.name),
            scheduledDate: formatDateKey(selectedDate),
            scheduledTimeId: slot.id,
            scheduledTimeLabel: slot.label,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            customerNotes: customer.notes,
            paymentIntent: customer.paymentIntent,
            totalCents,
            depositCents,
            remainingCents,
          },
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.ok || !payload.booking) {
        throw new Error(payload.error || 'Payment failed');
      }

      setConfirmedBooking(payload.booking);

      // Refresh taken slots so the UI reflects the new booking immediately.
      const takenIds = await fetchTakenSlotsForDate(formatDateKey(selectedDate));
      setTimeSlots(
        getBaseTimeSlots().map((s) => ({ ...s, available: !takenIds.includes(s.id) })),
      );
    } catch (error) {
      console.error('[booking] payment failed', error);
      setPaymentError(error?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedSlot = timeSlots.find((s) => s.id === selectedTimeId);

  return (
    <section className="booking-grid">
      <form className="card booking-form" onSubmit={handleSubmit}>
        {/* ── Step 1: Category + Service ── */}
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">Step 1</span>
            <h2>Choose Your Treatment</h2>
          </div>

          <ScrollShroud edges={tabsEdges} hintLabel="categories">
            <div ref={tabsRef} className="category-tabs">
              {serviceCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-tab ${activeCategoryId === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategoryId(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollShroud>

          <div className="service-grid">
            {activeCategory?.services.map((service) => (
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

        {/* ── Add-Ons ── */}
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">Optional</span>
            <h2>Add-Ons</h2>
          </div>

          <div className="addon-grid">
            {addOns.map((addon) => (
              <label
                key={addon.id}
                className={`addon-card ${selectedAddOns.includes(addon.id) ? 'active' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedAddOns.includes(addon.id)}
                  onChange={() => toggleAddOn(addon.id)}
                />
                <div className="addon-info">
                  <strong>{addon.name}</strong>
                  <span>{addon.price}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ── Step 2: Date & Time ── */}
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">Step 2</span>
            <h2>Pick a Date & Time</h2>
          </div>

          <ScrollShroud edges={datesEdges} hintLabel="dates">
            <div ref={datesRef} className="date-strip">
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
          </ScrollShroud>

          {selectedDate && (
            <div>
              <h3>{formatDateLabel(selectedDate)}</h3>
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
            </div>
          )}
        </div>

        {/* ── Step 3: Details ── */}
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">Step 3</span>
            <h2>Your Details</h2>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" required value={customer.name} onChange={handleCustomerChange} placeholder="Your full name" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required value={customer.email} onChange={handleCustomerChange} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" value={customer.phone} onChange={handleCustomerChange} placeholder="(555) 555-0122" />
            </div>
            <div className="field">
              <label htmlFor="paymentIntent">Payment option</label>
              <select id="paymentIntent" name="paymentIntent" value={customer.paymentIntent} onChange={handleCustomerChange}>
                <option value="deposit">Pay deposit now</option>
                <option value="full">Pay in full now</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="notes">Any notes for your esthetician?</label>
            <textarea id="notes" name="notes" value={customer.notes} onChange={handleCustomerChange} placeholder="Sensitive skin, preferred products, first-time visit, etc." />
          </div>
        </div>

        {/* ── Step 4: Payment ── */}
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">Step 4</span>
            <h2>Payment</h2>
          </div>

          <p className="muted" style={{ marginBottom: 8 }}>
            You'll be charged <strong>${chargeDollars}</strong>{' '}
            {customer.paymentIntent === 'full' ? 'for the full service' : 'as your deposit'}
            {selectedService ? ` to hold your ${selectedService.name}.` : '.'}
          </p>

          <div id="al-card-container" className="card-container" />

          {!paymentReady && !paymentError && (
            <small className="muted">Loading secure card form…</small>
          )}
          {paymentError && (
            <small className="payment-error">{paymentError}</small>
          )}
        </div>

        {/* ── Policy ── */}
        <div className="accent-card card">
          <div className="section-header left">
            <span className="eyebrow">Before you book</span>
            <h2>Cancellation Policy</h2>
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
            <input type="checkbox" checked={agreedToPolicy} onChange={() => setAgreedToPolicy((v) => !v)} />
            <span>I agree to the cancellation policy and authorize payment for any applicable fees.</span>
          </label>
        </div>

        {/* ── Submit ── */}
        <div className="action-row">
          <button
            className="button button-primary"
            type="submit"
            disabled={!paymentReady || isProcessing}
          >
            {isProcessing
              ? 'Processing payment…'
              : `Confirm & Pay $${chargeDollars || ''}`}
          </button>
        </div>

        {confirmedBooking && (
          <div className="success-banner">
            <strong>You're booked!</strong>
            <p>
              {confirmedBooking.customerName}, your {confirmedBooking.serviceName}
              {confirmedBooking.addOnNames?.length > 0 &&
                ` + ${confirmedBooking.addOnNames.join(', ')}`}
              {' '}is confirmed for {confirmedBooking.scheduledDate} at {confirmedBooking.scheduledTimeLabel}.
            </p>
            <p style={{ marginTop: 8 }}>
              Your booking code is{' '}
              <strong style={{ color: 'var(--gold, #d4a856)' }}>{confirmedBooking.code}</strong> —
              use this to manage your appointment in the customer portal.
              Charged today: ${(confirmedBooking.depositCents / 100).toFixed(
                confirmedBooking.depositCents % 100 === 0 ? 0 : 2,
              )}
              .
            </p>
          </div>
        )}
      </form>

      {/* ── Summary sidebar ── */}
      <aside className="card summary-card">
        <div className="stack">
          <div className="section-header left">
            <span className="eyebrow">Summary</span>
            <h2>{selectedService?.name ?? 'Pick a service'}</h2>
          </div>

          <div className="summary-price">
            <span>{selectedService?.duration}</span>
            <strong>${totalPrice}</strong>
          </div>

          {selectedAddOnItems.length > 0 && (
            <div className="summary-addons">
              {selectedAddOnItems.map((a) => (
                <div key={a.id} className="summary-addon-row">
                  <span>{a.name}</span>
                  <span>{a.price}</span>
                </div>
              ))}
            </div>
          )}

          <div className="timeline">
            <div className="timeline-item">
              <small>Date</small>
              <strong>{selectedDate ? formatDateLabel(selectedDate) : '—'}</strong>
            </div>
            <div className="timeline-item">
              <small>Time</small>
              <strong>{selectedSlot?.label ?? '—'}</strong>
            </div>
            <div className="timeline-item">
              <small>Deposit</small>
              <strong>{selectedService?.deposit ?? '—'}</strong>
            </div>
            <div className="timeline-item">
              <small>Late cancel fee</small>
              <strong>{selectedService?.cancellationFee ?? '—'}</strong>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
