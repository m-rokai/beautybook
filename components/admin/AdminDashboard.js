'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchBookings,
  patchBooking,
  requestBalanceLink,
  cancelBooking,
} from '../../lib/booking-store';

const formatDollars = (cents) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
};

// ── Pure derivation helpers from the bookings list ──────────────────────────

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function startOfWeekMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // back up to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function inThisWeek(scheduledDateStr) {
  const start = startOfWeekMonday();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const d = new Date(scheduledDateStr + 'T00:00:00');
  return d >= start && d < end;
}

function chargedCents(b) {
  // What we have actually collected so far for this booking.
  const deposit = b.depositSquareStatus === 'COMPLETED' ? (b.depositCents || 0) : 0;
  const balance = b.balanceStatus === 'paid' ? (b.totalCents - b.depositCents) : 0;
  return deposit + balance;
}

function deriveStats(bookings) {
  const live = bookings.filter((b) => b.status !== 'cancelled');
  const thisWeek = live.filter((b) => inThisWeek(b.scheduledDate));
  const revenueCents = thisWeek.reduce((sum, b) => sum + chargedCents(b), 0);
  const pendingBalanceCents = live.reduce(
    (sum, b) => sum + (b.balanceStatus !== 'paid' ? (b.remainingCents || 0) : 0),
    0,
  );
  const cancelledThisWeek = bookings.filter(
    (b) => b.status === 'cancelled' && inThisWeek(b.scheduledDate),
  ).length;

  return [
    { label: 'This week', value: `$${(revenueCents / 100).toFixed(0)}`, detail: `${thisWeek.length} booking${thisWeek.length === 1 ? '' : 's'} on the calendar.` },
    { label: 'Bookings this week', value: String(thisWeek.length), detail: 'Active appointments on the books.' },
    { label: 'Pending balance', value: `$${(pendingBalanceCents / 100).toFixed(0)}`, detail: 'Outstanding balance left to collect.' },
    { label: 'Cancellations', value: String(cancelledThisWeek), detail: 'Cancelled this week.' },
  ];
}

function deriveWeeklyRevenue(bookings) {
  const start = startOfWeekMonday();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: DAY_LABELS[d.getDay()], totalCents: 0, count: 0 });
  }
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const day = days.find((d) => d.key === b.scheduledDate);
    if (!day) continue;
    day.totalCents += chargedCents(b);
    day.count += 1;
  }
  return days;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Returns today's bookings sorted by start time, with a structured payment
// state hint per row so the UI can color-code at a glance.
function deriveTodaySchedule(bookings) {
  const key = todayKey();
  const rows = bookings
    .filter((b) => b.scheduledDate === key && b.status !== 'cancelled')
    .sort((a, b) => (a.scheduledTimeId || '').localeCompare(b.scheduledTimeId || ''));
  return rows.map((b) => ({
    ...b,
    paymentState:
      b.balanceStatus === 'paid'
        ? 'paid'
        : b.balanceStatus === 'link_sent'
        ? 'link_sent'
        : b.remainingCents > 0
        ? 'unpaid'
        : 'paid',
  }));
}

// Bookings that need Ashley's attention right now: future appointments with
// outstanding balance, or balance links that have been sent but not paid.
function deriveOutstandingActions(bookings) {
  const key = todayKey();
  return bookings
    .filter(
      (b) =>
        b.status !== 'cancelled' &&
        b.scheduledDate >= key &&
        b.remainingCents > 0 &&
        b.balanceStatus !== 'paid',
    )
    .sort((a, b) => (a.scheduledDate + a.scheduledTimeId).localeCompare(b.scheduledDate + b.scheduledTimeId));
}

// Top services in the last ~30 days by booking count.
function deriveServiceMix(bookings) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const counts = new Map();
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    if ((b.scheduledDate || '') < cutoffKey) continue;
    const name = b.serviceName || 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function deriveClientBook(bookings) {
  const byEmail = new Map();
  for (const b of bookings) {
    if (!b.customerEmail) continue;
    const key = b.customerEmail.toLowerCase();
    const entry = byEmail.get(key) ?? {
      email: b.customerEmail,
      name: b.customerName,
      visits: 0,
      lifetimeCents: 0,
      lastVisit: null,
      cancellations: 0,
    };
    entry.name = entry.name || b.customerName;
    entry.visits += 1;
    entry.lifetimeCents += chargedCents(b);
    if (b.status === 'cancelled') entry.cancellations += 1;
    if (!entry.lastVisit || b.scheduledDate > entry.lastVisit) entry.lastVisit = b.scheduledDate;
    byEmail.set(key, entry);
  }
  return Array.from(byEmail.values()).sort(
    (a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''),
  );
}

export function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [balanceState, setBalanceState] = useState({}); // { [code]: 'loading' | 'error' | null }
  const [balanceError, setBalanceError] = useState({}); // { [code]: string }
  const [cancelingCode, setCancelingCode] = useState(null); // which row is in confirm step
  const [cancelState, setCancelState] = useState({}); // { [code]: 'loading' | 'error' | null }
  const [cancelError, setCancelError] = useState({}); // { [code]: string }

  const refreshBookings = async () => {
    try {
      const rows = await fetchBookings();
      setBookings(rows);
      setLoadError('');
    } catch (error) {
      console.error('[admin] load bookings failed', error);
      setLoadError(error?.message || 'Failed to load bookings');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshBookings();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const replaceBookingInState = (updated) => {
    if (!updated) return;
    setBookings((current) => current.map((b) => (b.code === updated.code ? updated : b)));
  };

  const handleCollectBalance = async (booking) => {
    if (!booking?.remainingCents || booking.remainingCents <= 0) return;

    setBalanceState((s) => ({ ...s, [booking.code]: 'loading' }));
    setBalanceError((s) => ({ ...s, [booking.code]: '' }));

    try {
      const updated = await requestBalanceLink(booking.code);
      replaceBookingInState(updated);
      setBalanceState((s) => ({ ...s, [booking.code]: null }));
    } catch (error) {
      console.error('[admin] collect balance failed', error);
      setBalanceError((s) => ({ ...s, [booking.code]: error?.message || 'Failed' }));
      setBalanceState((s) => ({ ...s, [booking.code]: 'error' }));
    }
  };

  const handleCopyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const filteredBookings = useMemo(() => {
    if (selectedFilter === 'all') return bookings;
    return bookings.filter((b) => b.status === selectedFilter);
  }, [bookings, selectedFilter]);

  const handleStatusChange = async (code, status) => {
    try {
      const updated = await patchBooking(code, { status });
      replaceBookingInState(updated);
    } catch (error) {
      console.error('[admin] status change failed', error);
    }
  };

  const handleCancelWithRefund = async (code, refund) => {
    setCancelState((s) => ({ ...s, [code]: 'loading' }));
    setCancelError((s) => ({ ...s, [code]: '' }));
    try {
      const data = await cancelBooking(code, { refund });
      replaceBookingInState(data.booking);
      setCancelState((s) => ({ ...s, [code]: null }));
      setCancelingCode(null);
    } catch (error) {
      console.error('[admin] cancel failed', error);
      setCancelError((s) => ({ ...s, [code]: error?.message || 'Cancel failed' }));
      setCancelState((s) => ({ ...s, [code]: 'error' }));
    }
  };

  const bookingCounts = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    return { total: bookings.length, confirmed, pending, cancelled };
  }, [bookings]);

  const liveStats = useMemo(() => deriveStats(bookings), [bookings]);
  const weeklyRevenue = useMemo(() => deriveWeeklyRevenue(bookings), [bookings]);
  const clientBook = useMemo(() => deriveClientBook(bookings), [bookings]);
  const todaySchedule = useMemo(() => deriveTodaySchedule(bookings), [bookings]);
  const outstanding = useMemo(() => deriveOutstandingActions(bookings), [bookings]);
  const serviceMix = useMemo(() => deriveServiceMix(bookings), [bookings]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  return (
    <section className="dashboard-grid">
      <div className="dashboard-column">
        {/* ── Today's schedule ── */}
        <div className="card today-card">
          <div className="today-header">
            <div>
              <span className="eyebrow">Today</span>
              <h2>{todayLabel}</h2>
            </div>
            <div className="today-meta">
              <strong className="tabular-nums">{todaySchedule.length}</strong>
              <span>{todaySchedule.length === 1 ? 'appointment' : 'appointments'}</span>
            </div>
          </div>
          {todaySchedule.length === 0 ? (
            <p className="muted">No appointments today. Enjoy the breather.</p>
          ) : (
            <ol className="today-list">
              {todaySchedule.map((b) => (
                <li key={b.code} className="today-row">
                  <span className="today-time tabular-nums">{b.scheduledTimeLabel}</span>
                  <div className="today-body">
                    <strong>{b.customerName}</strong>
                    <span className="muted">{b.serviceName}</span>
                  </div>
                  <span className={`status-pill ${b.paymentState === 'paid' ? 'success' : b.paymentState === 'link_sent' ? 'gold' : 'warning'}`}>
                    {b.paymentState === 'paid' ? 'Paid' : b.paymentState === 'link_sent' ? 'Link sent' : `${formatDollars(b.remainingCents)} due`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ── Live stats — derived from real bookings ── */}
        <div className="stats-grid">
          {liveStats.map((card) => (
            <article key={card.label} className="stats-card card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        {/* ── Appointment board — live from Postgres ── */}
        <div className="card">
          <div className="dashboard-toolbar">
            <div>
              <span className="eyebrow">
                {loading ? 'Loading…' : `${bookings.length} bookings`}
              </span>
              <h2>Appointments</h2>
            </div>

            <div className="field">
              <label htmlFor="statusFilter">Filter</label>
              <select
                id="statusFilter"
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
              >
                <option value="all">All ({bookingCounts.total})</option>
                <option value="confirmed">Confirmed ({bookingCounts.confirmed})</option>
                <option value="pending">Pending ({bookingCounts.pending})</option>
                <option value="cancelled">Cancelled ({bookingCounts.cancelled})</option>
              </select>
            </div>
          </div>

          <div className="table-stack">
            <div className="table-header">
              <span>Client</span>
              <span>Service</span>
              <span>When</span>
              <span>Status</span>
            </div>

            {loadError && (
              <div className="empty-state">Error loading bookings: {loadError}</div>
            )}
            {!loading && !loadError && filteredBookings.length === 0 && (
              <div className="empty-state">
                No {selectedFilter === 'all' ? '' : selectedFilter} bookings yet.
              </div>
            )}

            {filteredBookings.map((booking) => {
              const hasBalance =
                typeof booking.remainingCents === 'number' && booking.remainingCents > 0;
              const balanceIsPaid = booking.balanceStatus === 'paid';
              const linkState = balanceState[booking.code];
              const linkErr = balanceError[booking.code];

              return (
                <div key={booking.code} className="table-row">
                  <div>
                    <strong>{booking.customerName}</strong>
                    <p>{booking.customerEmail}</p>
                    <p className="muted" style={{ fontSize: '0.78rem' }}>{booking.code}</p>
                  </div>
                  <div>
                    <strong>{booking.serviceName}</strong>
                    <p>Deposit {formatDollars(booking.depositCents)}</p>
                    {hasBalance && !balanceIsPaid && (
                      <p className="muted" style={{ fontSize: '0.82rem' }}>
                        Balance owed: <strong>{formatDollars(booking.remainingCents)}</strong>
                      </p>
                    )}
                    {balanceIsPaid && (
                      <p style={{ fontSize: '0.82rem', color: 'var(--success)' }}>Paid in full</p>
                    )}
                  </div>
                  <div>
                    <strong>{booking.scheduledTimeLabel}</strong>
                    <p>{booking.scheduledDate}</p>
                  </div>
                  <div className="stack">
                    <span
                      className={`status-pill ${
                        booking.status === 'cancelled'
                          ? 'warning'
                          : booking.status === 'confirmed'
                          ? 'success'
                          : 'gold'
                      }`}
                    >
                      {booking.status}
                    </span>

                    {booking.status !== 'cancelled' && cancelingCode !== booking.code && (
                      <div className="action-row">
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => handleStatusChange(booking.code, 'confirmed')}
                        >
                          Confirm
                        </button>
                        <button
                          className="button button-danger"
                          type="button"
                          onClick={() => {
                            setCancelingCode(booking.code);
                            setCancelError((s) => ({ ...s, [booking.code]: '' }));
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {booking.status !== 'cancelled' && cancelingCode === booking.code && (
                      <div className="cancel-confirm" role="dialog" aria-label="Cancel booking">
                        <p className="cancel-confirm-title">Cancel this booking?</p>
                        <p className="cancel-confirm-meta">
                          {booking.depositSquarePaymentId
                            ? `Deposit ${formatDollars(booking.depositCents)} was charged on this card.`
                            : 'No deposit payment is on file for this booking.'}
                        </p>
                        <div className="cancel-confirm-actions">
                          {booking.depositSquarePaymentId && (
                            <button
                              type="button"
                              className="button button-primary"
                              disabled={cancelState[booking.code] === 'loading'}
                              onClick={() =>
                                handleCancelWithRefund(
                                  booking.code,
                                  booking.balanceStatus === 'paid' ? 'full' : 'deposit',
                                )
                              }
                            >
                              {cancelState[booking.code] === 'loading'
                                ? 'Refunding…'
                                : booking.balanceStatus === 'paid'
                                ? `Refund full ${formatDollars(booking.totalCents)} & cancel`
                                : `Refund ${formatDollars(booking.depositCents)} & cancel`}
                            </button>
                          )}
                          <button
                            type="button"
                            className="button button-danger"
                            disabled={cancelState[booking.code] === 'loading'}
                            onClick={() => handleCancelWithRefund(booking.code, 'none')}
                          >
                            Cancel without refund
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            disabled={cancelState[booking.code] === 'loading'}
                            onClick={() => setCancelingCode(null)}
                          >
                            Keep booking
                          </button>
                        </div>
                        {cancelError[booking.code] && (
                          <p className="payment-error" role="alert">
                            {cancelError[booking.code]}
                          </p>
                        )}
                      </div>
                    )}

                    {booking.status === 'cancelled' && booking.refundStatus && (
                      <p className="refund-note">
                        Refunded {formatDollars(booking.refundCents || 0)}
                        {booking.refundStatus === 'pending' && ' (pending)'}
                        {booking.refundStatus === 'failed' && ' — failed'}
                      </p>
                    )}

                    {booking.status !== 'cancelled' && hasBalance && !balanceIsPaid && (
                      <div className="stack" style={{ gap: 6, marginTop: 4 }}>
                        {!booking.balanceLinkUrl ? (
                          <button
                            className="button button-primary"
                            type="button"
                            onClick={() => handleCollectBalance(booking)}
                            disabled={linkState === 'loading'}
                          >
                            {linkState === 'loading'
                              ? 'Creating link…'
                              : `Send payment link (${formatDollars(booking.remainingCents)})`}
                          </button>
                        ) : (
                          <div className="note-card" style={{ padding: 10 }}>
                            <strong style={{ fontSize: '0.82rem' }}>Payment link ready</strong>
                            <p style={{
                              fontSize: '0.78rem',
                              wordBreak: 'break-all',
                              marginTop: 4,
                            }}>
                              <a href={booking.balanceLinkUrl} target="_blank" rel="noreferrer">
                                {booking.balanceLinkUrl}
                              </a>
                            </p>
                            <div className="action-row" style={{ marginTop: 6 }}>
                              <button
                                type="button"
                                className="button button-secondary"
                                onClick={() => handleCopyLink(booking.balanceLinkUrl)}
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                className="button button-secondary"
                                onClick={() => handleCollectBalance(booking)}
                              >
                                Regenerate
                              </button>
                            </div>
                          </div>
                        )}
                        {linkErr && (
                          <small className="payment-error">{linkErr}</small>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Revenue — live, by day of the current week ── */}
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">This week</span>
            <h2>Revenue</h2>
          </div>

          <div className="timeline">
            {weeklyRevenue.map((day) => (
              <div key={day.key} className="timeline-item">
                <div className="timeline-meta">
                  <strong>{day.label}</strong>
                  <span className={`status-pill ${day.totalCents > 0 ? 'gold' : ''}`}>
                    {formatDollars(day.totalCents)}
                  </span>
                </div>
                <p className="muted" style={{ marginTop: 4, fontSize: '0.88rem' }}>
                  {day.count === 0
                    ? 'No appointments.'
                    : `${day.count} appointment${day.count === 1 ? '' : 's'}.`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-column">
        {/* ── Outstanding — bookings that need attention ── */}
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Needs attention</span>
            <h2>Outstanding</h2>
          </div>
          {outstanding.length === 0 ? (
            <p className="muted">Nothing outstanding. Every upcoming booking is paid or scheduled to settle on the day.</p>
          ) : (
            <ul className="outstanding-list">
              {outstanding.map((b) => (
                <li key={b.code} className="outstanding-row">
                  <div>
                    <strong>{b.customerName}</strong>
                    <span className="muted">
                      {b.scheduledDate} · {b.scheduledTimeLabel} · {b.serviceName}
                    </span>
                  </div>
                  <span className={`status-pill ${b.balanceStatus === 'link_sent' ? 'gold' : 'warning'}`}>
                    {b.balanceStatus === 'link_sent' ? 'Link sent' : 'Unpaid'} · {formatDollars(b.remainingCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Service mix — last 30 days ── */}
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Last 30 days</span>
            <h2>Service Mix</h2>
          </div>
          {serviceMix.length === 0 ? (
            <p className="muted">No completed bookings in the last 30 days yet.</p>
          ) : (
            <ul className="service-mix-list">
              {serviceMix.map((s) => (
                <li key={s.name} className="service-mix-row">
                  <div className="service-mix-meta">
                    <strong>{s.name}</strong>
                    <span className="muted tabular-nums">
                      {s.count} · {Math.round(s.share * 100)}%
                    </span>
                  </div>
                  <div className="service-mix-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(6, Math.round(s.share * 100))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Client book — deduped from real bookings ── */}
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Clients</span>
            <h2>Client Book</h2>
          </div>

          {clientBook.length === 0 ? (
            <p className="muted">No clients yet — they&apos;ll show up here after their first booking.</p>
          ) : (
            <div className="customer-grid">
              {clientBook.map((c) => {
                const isRepeat = c.visits >= 2;
                return (
                  <article key={c.email} className="note-card">
                    <div className="customer-meta">
                      <div>
                        <strong>{c.name || c.email}</strong>
                        <p>{c.email}</p>
                      </div>
                      <span className={`status-pill ${isRepeat ? 'gold' : ''}`}>
                        {isRepeat ? `${c.visits} visits` : 'New'}
                      </span>
                    </div>
                    <ul className="list-tight" style={{ marginTop: 10 }}>
                      <li>Lifetime spend: {formatDollars(c.lifetimeCents)}</li>
                      <li>Last visit: {c.lastVisit || '—'}</li>
                      {c.cancellations > 0 && (
                        <li>Cancellations: {c.cancellations}</li>
                      )}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
