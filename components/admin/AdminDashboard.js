'use client';

import { useEffect, useMemo, useState } from 'react';
import { getBookings, updateBooking, seedIfEmpty } from '../../lib/booking-store';

const formatDollars = (cents) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '$0';
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
};

export function AdminDashboard({ stats, revenue, customers, automations }) {
  const [bookings, setBookings] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [balanceState, setBalanceState] = useState({}); // { [code]: 'loading' | 'error' | null }
  const [balanceError, setBalanceError] = useState({}); // { [code]: string }

  useEffect(() => {
    seedIfEmpty();
    setBookings(getBookings());
  }, []);

  const refreshBookings = () => setBookings(getBookings());

  const handleCollectBalance = async (booking) => {
    if (!booking?.remainingCents || booking.remainingCents <= 0) return;

    setBalanceState((s) => ({ ...s, [booking.code]: 'loading' }));
    setBalanceError((s) => ({ ...s, [booking.code]: '' }));

    try {
      const res = await fetch('/api/bookings/collect-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingCode: booking.code,
          amountCents: booking.remainingCents,
          serviceName: booking.service,
          customer: { name: booking.customer, email: booking.email },
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to create payment link');
      }

      updateBooking(booking.code, {
        balanceStatus: 'link_sent',
        balanceLinkId: payload.linkId,
        balanceLinkUrl: payload.url,
        balanceOrderId: payload.orderId,
      });
      refreshBookings();
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

  const handleStatusChange = (code, status) => {
    updateBooking(code, { status });
    refreshBookings();
  };

  const bookingCounts = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    return { total: bookings.length, confirmed, pending, cancelled };
  }, [bookings]);

  return (
    <section className="dashboard-grid">
      <div className="dashboard-column">
        {/* ── Live stats ── */}
        <div className="stats-grid">
          {stats.cards.map((card) => (
            <article key={card.label} className="stats-card card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        {/* ── Appointment board — reads from localStorage ── */}
        <div className="card">
          <div className="dashboard-toolbar">
            <div>
              <span className="eyebrow">{bookings.length} bookings</span>
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

            {filteredBookings.length === 0 && (
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
                    <strong>{booking.customer}</strong>
                    <p>{booking.email}</p>
                    <p className="muted" style={{ fontSize: '0.78rem' }}>{booking.code}</p>
                  </div>
                  <div>
                    <strong>{booking.service}</strong>
                    <p>Deposit {booking.chargeToday}</p>
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
                    <strong>{booking.timeLabel}</strong>
                    <p>{booking.dateLabel}</p>
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

                    {booking.status !== 'cancelled' && (
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
                          onClick={() => handleStatusChange(booking.code, 'cancelled')}
                        >
                          Cancel
                        </button>
                      </div>
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

        {/* ── Revenue (sample data) ── */}
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">This week</span>
            <h2>Revenue</h2>
          </div>

          <div className="timeline">
            {revenue.map((day) => (
              <div key={day.day} className="timeline-item">
                <div className="timeline-meta">
                  <strong>{day.day}</strong>
                  <span className="status-pill gold">{day.total}</span>
                </div>
                <p className="muted" style={{ marginTop: 4, fontSize: '0.88rem' }}>{day.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-column">
        {/* ── Client book (sample data) ── */}
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Clients</span>
            <h2>Client Book</h2>
          </div>

          <div className="customer-grid">
            {customers.map((customer) => (
              <article key={customer.id} className="note-card">
                <div className="customer-meta">
                  <div>
                    <strong>{customer.name}</strong>
                    <p>{customer.email}</p>
                  </div>
                  <span className={`status-pill ${customer.segment === 'VIP' ? 'gold' : ''}`}>
                    {customer.segment}
                  </span>
                </div>
                <p>{customer.story}</p>
                <ul className="list-tight" style={{ marginTop: 10 }}>
                  <li>Lifetime spend: {customer.lifetimeSpend}</li>
                  <li>Last visit: {customer.lastVisit}</li>
                  <li>Next step: {customer.nextAction}</li>
                </ul>
              </article>
            ))}
          </div>
        </div>

        {/* ── Automations ── */}
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Automations</span>
            <h2>Follow-up Workflows</h2>
          </div>

          <div className="retention-grid">
            {automations.map((automation) => (
              <article key={automation.title} className="note-card">
                <strong>{automation.title}</strong>
                <p>{automation.copy}</p>
                <small>{automation.trigger}</small>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
