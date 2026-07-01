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
import { depositForTotalCents, cancellationForTotalCents } from '../../lib/pricing';

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

const STEPS = [
  { id: 'services', label: 'Service' },
  { id: 'addons', label: 'Add-ons' },
  { id: 'time', label: 'When' },
  { id: 'details', label: 'You' },
  { id: 'review', label: 'Pay' },
];

export function BookingExperience({ serviceCategories, addOns, policies }) {
  const [tabsRef, tabsEdges] = useScrollEdges();
  const [datesRef, datesEdges] = useScrollEdges();

  // ── Wizard step state ──
  // currentStep is 0-indexed across STEPS. direction controls slide animation.
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState('forward');

  // ── Booking state ──
  const [activeCategoryId, setActiveCategoryId] = useState(serviceCategories[0]?.id ?? '');
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
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
  const [paymentsInstance, setPaymentsInstance] = useState(null);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Derived ──
  const activeCategory = useMemo(
    () => serviceCategories.find((c) => c.id === activeCategoryId),
    [activeCategoryId, serviceCategories],
  );

  const allServices = useMemo(
    () => serviceCategories.flatMap((c) => c.services),
    [serviceCategories],
  );

  const selectedServices = useMemo(
    () => selectedServiceIds.map((id) => allServices.find((s) => s.id === id)).filter(Boolean),
    [allServices, selectedServiceIds],
  );

  const selectedAddOnItems = useMemo(
    () => addOns.filter((a) => selectedAddOns.includes(a.id)),
    [addOns, selectedAddOns],
  );

  const totalCents = useMemo(() => {
    const services = selectedServices.reduce((sum, s) => sum + (s?.priceNum ?? 0) * 100, 0);
    const addons = selectedAddOnItems.reduce((sum, a) => sum + a.priceNum * 100, 0);
    return services + addons;
  }, [selectedServices, selectedAddOnItems]);

  const depositCents = useMemo(() => depositForTotalCents(totalCents), [totalCents]);
  const cancellationCents = useMemo(() => cancellationForTotalCents(totalCents), [totalCents]);
  const chargeCents = customer.paymentIntent === 'full' ? totalCents : depositCents;

  const selectedSlot = timeSlots.find((s) => s.id === selectedTimeId);

  // ── Effects ──
  useEffect(() => {
    const available = getAvailableDates(14);
    setDates(available);
    if (available.length > 0) setSelectedDate(available[0]);
  }, []);

  // Refetch availability when date or service-set changes — total candidate
  // duration is the sum of every selected service, so adding/removing one
  // shifts which start slots are valid.
  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    (async () => {
      try {
        const takenIds = await fetchTakenSlotsForDate(
          formatDateKey(selectedDate),
          selectedServiceIds,
        );
        if (cancelled) return;
        const slots = getBaseTimeSlots().map((slot) => ({
          ...slot,
          available: !takenIds.includes(slot.id),
        }));
        setTimeSlots(slots);
        setSelectedTimeId((prev) => {
          if (prev && slots.find((s) => s.id === prev && s.available)) return prev;
          return slots.find((s) => s.available)?.id ?? '';
        });
      } catch (error) {
        console.error('[booking] availability fetch failed', error);
        const slots = getBaseTimeSlots().map((s) => ({ ...s, available: true }));
        setTimeSlots(slots);
        setSelectedTimeId(slots[0]?.id ?? '');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedServiceIds]);

  // Square SDK: load the script + create the payments instance once on mount.
  // The card form itself attaches in the effect below — #al-card-container only
  // exists while the Pay step is rendered (wizard steps are conditional), so
  // attaching here would throw ElementNotFoundError before the customer ever
  // reaches payment.
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

    if (!appId || !locationId) {
      setPaymentError(
        "We can't take payment right now — please try again in a moment. " +
          'If you keep seeing this, hard-refresh the page (Shift-Reload) or contact us.',
      );
      console.error('[booking] Square config missing', { appId: !!appId, locationId: !!locationId });
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
        setPaymentsInstance(window.Square.payments(appId, locationId));
      } catch (error) {
        console.error('[square] init failed', error);
        setPaymentError(error?.message || 'Could not initialize card form.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Attach the card form whenever the Pay step is visible; destroy it when the
  // customer navigates away so re-entering the step re-attaches to the freshly
  // rendered container.
  useEffect(() => {
    if (currentStep !== 4 || !paymentsInstance) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const card = await paymentsInstance.card();
        if (cancelled) {
          await card.destroy?.();
          return;
        }
        await card.attach('#al-card-container');
        if (cancelled) {
          await card.destroy?.();
          return;
        }
        cardRef.current = card;
        setPaymentReady(true);
        setPaymentError('');
      } catch (error) {
        console.error('[square] card attach failed', error);
        setPaymentError(error?.message || 'Could not initialize card form.');
      }
    })();

    return () => {
      cancelled = true;
      setPaymentReady(false);
      if (cardRef.current) {
        cardRef.current.destroy?.().catch(() => {});
        cardRef.current = null;
      }
    };
  }, [currentStep, paymentsInstance]);

  // ── Handlers ──
  const toggleService = (id) => {
    setSelectedServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleAddOn = (id) => {
    setSelectedAddOns((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const handleCustomerChange = (event) => {
    const { name, value } = event.target;
    setCustomer((c) => ({ ...c, [name]: value }));
  };

  // ── Step validation ──
  const stepValid = (idx) => {
    switch (idx) {
      case 0: return selectedServiceIds.length > 0;
      case 1: return true; // add-ons optional
      case 2: return Boolean(selectedDate && selectedTimeId);
      case 3: return Boolean(customer.name.trim() && /\S+@\S+\.\S+/.test(customer.email));
      case 4: return paymentReady && agreedToPolicy && chargeCents > 0;
      default: return true;
    }
  };

  const goNext = () => {
    if (!stepValid(currentStep)) return;
    setDirection('forward');
    setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => {
    setDirection('backward');
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  const goToStep = (idx) => {
    // Tappable progress bar — only allow jumping to a step ≤ current (back) or
    // to the next step if current is valid.
    if (idx === currentStep) return;
    if (idx < currentStep) {
      setDirection('backward');
      setCurrentStep(idx);
      return;
    }
    if (idx === currentStep + 1 && stepValid(currentStep)) {
      setDirection('forward');
      setCurrentStep(idx);
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    setPaymentError('');

    if (!stepValid(4)) return;
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
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== 'OK') {
        const detail =
          tokenResult.errors?.map((e) => e.message).join(', ') || 'Card could not be validated.';
        throw new Error(detail);
      }

      const remainingCents = Math.max(0, totalCents - chargeCents);
      const serviceNameJoined = selectedServices.map((s) => s.name).join(' + ');

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          booking: {
            serviceId: selectedServiceIds[0],
            serviceName: serviceNameJoined,
            serviceIds: selectedServiceIds,
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
            depositCents: chargeCents,
            remainingCents,
          },
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.ok || !payload.booking) {
        throw new Error(payload.error || 'Payment failed');
      }

      setConfirmedBooking(payload.booking);
      setDirection('forward');
      setCurrentStep(STEPS.length); // sentinel: confirmation screen
    } catch (error) {
      console.error('[booking] payment failed', error);
      setPaymentError(error?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Confirmation screen ──
  if (confirmedBooking) {
    return (
      <section className="wizard">
        <div className="wizard-step wizard-confirmation">
          <div className="wizard-confirm-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="eyebrow">Booking confirmed</span>
          <h1>You&rsquo;re booked.</h1>
          <p className="wizard-confirm-meta">
            {confirmedBooking.customerName}, your appointment is locked in. We just emailed your confirmation to {confirmedBooking.customerEmail}.
          </p>
          <div className="wizard-confirm-card card">
            <div className="wizard-confirm-row">
              <span>Reference</span>
              <strong className="wizard-confirm-code">{confirmedBooking.code}</strong>
            </div>
            <div className="wizard-confirm-row">
              <span>Service</span>
              <strong>{confirmedBooking.serviceName}</strong>
            </div>
            {confirmedBooking.addOnNames?.length > 0 && (
              <div className="wizard-confirm-row">
                <span>Add-ons</span>
                <strong>{confirmedBooking.addOnNames.join(', ')}</strong>
              </div>
            )}
            <div className="wizard-confirm-row">
              <span>When</span>
              <strong>{confirmedBooking.scheduledDate} · {confirmedBooking.scheduledTimeLabel}</strong>
            </div>
            <div className="wizard-confirm-row">
              <span>Charged today</span>
              <strong>${(confirmedBooking.depositCents / 100).toFixed(confirmedBooking.depositCents % 100 === 0 ? 0 : 2)}</strong>
            </div>
            {confirmedBooking.remainingCents > 0 && (
              <div className="wizard-confirm-row">
                <span>Balance at appointment</span>
                <strong>${(confirmedBooking.remainingCents / 100).toFixed(confirmedBooking.remainingCents % 100 === 0 ? 0 : 2)}</strong>
              </div>
            )}
          </div>
          <p className="wizard-confirm-meta muted">
            Need to manage your booking? Use your reference code at the customer portal.
          </p>
        </div>
      </section>
    );
  }

  // ── Wizard render ──
  const stepClassName = `wizard-step wizard-step--${direction}`;

  return (
    <section className="wizard">
      {/* Progress bar */}
      <ol className="wizard-progress" aria-label="Booking progress">
        {STEPS.map((step, idx) => {
          const completed = idx < currentStep;
          const active = idx === currentStep;
          const reachable = idx <= currentStep || (idx === currentStep + 1 && stepValid(currentStep));
          return (
            <li
              key={step.id}
              className={`wizard-progress-step ${active ? 'is-active' : ''} ${completed ? 'is-done' : ''}`}
            >
              <button
                type="button"
                className="wizard-progress-button"
                onClick={() => goToStep(idx)}
                disabled={!reachable}
                aria-current={active ? 'step' : undefined}
              >
                <span className="wizard-progress-dot" aria-hidden="true">
                  {completed ? (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="wizard-progress-label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <form className="wizard-form" onSubmit={handleSubmit} noValidate>
        <div className="wizard-stage">
          <div key={currentStep} className={stepClassName}>
            {/* Step 1 — Services */}
            {currentStep === 0 && (
              <div className="wizard-pane">
                <header className="wizard-pane-header">
                  <span className="eyebrow">Step 1 of {STEPS.length}</span>
                  <h2>What would you like?</h2>
                  <p className="muted">Tap any number of services. Pricing updates as you add.</p>
                </header>

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
                  {activeCategory?.services.map((service) => {
                    const checked = selectedServiceIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        className={`service-card ${checked ? 'active' : ''}`}
                        onClick={() => toggleService(service.id)}
                        aria-pressed={checked}
                      >
                        <span className="service-card-check" aria-hidden="true">
                          {checked && (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <h3>{service.name}</h3>
                        <p>{service.description}</p>
                        <div className="service-meta">
                          <span>{service.duration}</span>
                          <strong>{service.price}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2 — Add-ons */}
            {currentStep === 1 && (
              <div className="wizard-pane">
                <header className="wizard-pane-header">
                  <span className="eyebrow">Step 2 of {STEPS.length}</span>
                  <h2>Anything to add?</h2>
                  <p className="muted">Add-ons are optional — skip if you don&rsquo;t need them.</p>
                </header>

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
            )}

            {/* Step 3 — Date & Time */}
            {currentStep === 2 && (
              <div className="wizard-pane">
                <header className="wizard-pane-header">
                  <span className="eyebrow">Step 3 of {STEPS.length}</span>
                  <h2>When works for you?</h2>
                  <p className="muted">Pick a day, then a time. Booked slots are crossed out.</p>
                </header>

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
                  <div className="time-picker">
                    <h3>{formatDateLabel(selectedDate)}</h3>
                    {['morning', 'afternoon', 'evening'].map((period) => {
                      const slots = timeSlots.filter((s) => s.period === period);
                      if (!slots.length) return null;
                      const openCount = slots.filter((s) => s.available).length;
                      const label = period === 'morning' ? 'Morning' : period === 'afternoon' ? 'Afternoon' : 'Evening';
                      return (
                        <div key={period} className="time-section">
                          <div className="time-section-header">
                            <span className="time-section-label">{label}</span>
                            <span className="time-section-meta">
                              {openCount === 0 ? 'fully booked' : `${openCount} open`}
                            </span>
                          </div>
                          <div className="time-grid">
                            {slots.map((slot) => (
                              <button
                                key={slot.id}
                                type="button"
                                disabled={!slot.available}
                                className={`slot-pill ${selectedTimeId === slot.id ? 'active' : ''} ${!slot.available ? 'booked' : ''}`}
                                onClick={() => slot.available && setSelectedTimeId(slot.id)}
                                aria-pressed={selectedTimeId === slot.id}
                                aria-label={`${slot.label}${slot.available ? '' : ' (booked)'}`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 4 — Customer details */}
            {currentStep === 3 && (
              <div className="wizard-pane">
                <header className="wizard-pane-header">
                  <span className="eyebrow">Step 4 of {STEPS.length}</span>
                  <h2>Your details</h2>
                  <p className="muted">We&rsquo;ll send the confirmation to your email.</p>
                </header>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="name">Full name</label>
                    <input id="name" name="name" required value={customer.name} onChange={handleCustomerChange} placeholder="Your full name" autoComplete="name" />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" required value={customer.email} onChange={handleCustomerChange} placeholder="you@example.com" autoComplete="email" />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input id="phone" name="phone" type="tel" value={customer.phone} onChange={handleCustomerChange} placeholder="(555) 555-0122" autoComplete="tel" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="notes">Anything we should know?</label>
                  <textarea id="notes" name="notes" value={customer.notes} onChange={handleCustomerChange} placeholder="Sensitive skin, preferred products, first-time visit, allergies, etc." />
                </div>
              </div>
            )}

            {/* Step 5 — Review & Pay */}
            {currentStep === 4 && (
              <div className="wizard-pane">
                <header className="wizard-pane-header">
                  <span className="eyebrow">Step 5 of {STEPS.length}</span>
                  <h2>Review &amp; pay</h2>
                  <p className="muted">One last look, then we&rsquo;ll confirm your booking.</p>
                </header>

                <div className="card review-card">
                  <h3 className="review-section-title">Your booking</h3>
                  <ul className="review-list">
                    {selectedServices.map((s) => (
                      <li key={s.id} className="review-row">
                        <span>{s.name}</span>
                        <small className="muted">{s.duration}</small>
                        <strong>{s.price}</strong>
                      </li>
                    ))}
                    {selectedAddOnItems.map((a) => (
                      <li key={a.id} className="review-row review-row-addon">
                        <span>+ {a.name}</span>
                        <small className="muted">add-on</small>
                        <strong>{a.price}</strong>
                      </li>
                    ))}
                  </ul>

                  <div className="review-meta">
                    <div className="review-meta-row">
                      <span>When</span>
                      <strong>{selectedDate ? formatDateLabel(selectedDate) : '—'} · {selectedSlot?.label ?? '—'}</strong>
                    </div>
                    <div className="review-meta-row">
                      <span>Total</span>
                      <strong className="review-total">${(totalCents / 100).toFixed(0)}</strong>
                    </div>
                    <div className="review-meta-row">
                      <span>Late cancel fee</span>
                      <strong>${(cancellationCents / 100).toFixed(0)}</strong>
                    </div>
                  </div>
                </div>

                <div className="field payment-intent-field">
                  <label htmlFor="paymentIntent">Payment</label>
                  <select id="paymentIntent" name="paymentIntent" value={customer.paymentIntent} onChange={handleCustomerChange}>
                    <option value="deposit">Pay ${(depositCents / 100).toFixed(0)} deposit now (balance at appointment)</option>
                    <option value="full">Pay ${(totalCents / 100).toFixed(0)} in full now</option>
                  </select>
                </div>

                <div className="payment-card">
                  <h3 className="review-section-title">Card</h3>
                  <div id="al-card-container" className="card-container" />
                  {!paymentReady && !paymentError && (
                    <small className="muted">Loading secure card form…</small>
                  )}
                  {paymentError && <small className="payment-error">{paymentError}</small>}
                </div>

                <div className="card accent-card policy-card">
                  <h3 className="review-section-title">Cancellation policy</h3>
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
              </div>
            )}
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <div className="wizard-cta">
          <div className="wizard-cta-inner">
            <button
              type="button"
              className="button button-secondary wizard-back"
              onClick={goBack}
              disabled={currentStep === 0 || isProcessing}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 6 9 12 15 18" />
              </svg>
              Back
            </button>

            {currentStep < STEPS.length - 1 ? (
              <div className="wizard-cta-primary">
                {selectedServiceIds.length > 0 && (
                  <span className="wizard-cta-cart">
                    {selectedServiceIds.length} {selectedServiceIds.length === 1 ? 'service' : 'services'} · ${(totalCents / 100).toFixed(0)}
                  </span>
                )}
                <button
                  type="button"
                  className="button button-primary"
                  onClick={goNext}
                  disabled={!stepValid(currentStep)}
                >
                  {currentStep === 1 && selectedAddOns.length === 0 ? 'Skip' : 'Continue'}
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="submit"
                className="button button-primary wizard-pay"
                disabled={!stepValid(4) || isProcessing}
              >
                {isProcessing ? 'Processing…' : `Pay $${(chargeCents / 100).toFixed(0)}`}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
