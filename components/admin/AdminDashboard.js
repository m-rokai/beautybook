'use client';

import { useMemo, useState } from 'react';

export function AdminDashboard({ stats, appointments, revenue, customers, automations, notes }) {
  const [appointmentState, setAppointmentState] = useState(appointments);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filteredAppointments = useMemo(() => {
    if (selectedFilter === 'all') return appointmentState;
    return appointmentState.filter((appointment) => appointment.status === selectedFilter);
  }, [appointmentState, selectedFilter]);

  const handleStatusChange = (id, status) => {
    setAppointmentState((current) =>
      current.map((appointment) => (appointment.id === id ? { ...appointment, status } : appointment))
    );
  };

  return (
    <section className="dashboard-grid">
      <div className="dashboard-column">
        <div className="stats-grid">
          {stats.cards.map((card) => (
            <article key={card.label} className="stats-card card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>

        <div className="card">
          <div className="dashboard-toolbar">
            <div>
              <span className="eyebrow">Today</span>
              <h2>Appointment board</h2>
            </div>

            <div className="field">
              <label htmlFor="statusFilter">Filter</label>
              <select
                id="statusFilter"
                value={selectedFilter}
                onChange={(event) => setSelectedFilter(event.target.value)}
              >
                <option value="all">All appointments</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="table-stack">
            <div className="table-header">
              <span>Guest</span>
              <span>Service</span>
              <span>When</span>
              <span>Status</span>
            </div>

            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="table-row">
                <div>
                  <strong>{appointment.customer}</strong>
                  <p>{appointment.contact}</p>
                </div>
                <div>
                  <strong>{appointment.service}</strong>
                  <p>{appointment.amount}</p>
                </div>
                <div>
                  <strong>{appointment.time}</strong>
                  <p>{appointment.date}</p>
                </div>
                <div className="stack">
                  <span
                    className={`status-pill ${
                      appointment.status === 'cancelled'
                        ? 'warning'
                        : appointment.status === 'confirmed'
                        ? 'gold'
                        : ''
                    }`}
                  >
                    {appointment.status}
                  </span>
                  <div className="action-row">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                    >
                      Confirm
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => handleStatusChange(appointment.id, 'cancelled')}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Revenue snapshot</span>
            <h2>Weekly performance</h2>
          </div>

          <div className="timeline">
            {revenue.map((day) => (
              <div key={day.day} className="timeline-item">
                <div className="timeline-meta">
                  <strong>{day.day}</strong>
                  <span className="status-pill gold">{day.total}</span>
                </div>
                <p>{day.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-column">
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Retention CRM</span>
            <h2>Customer roster</h2>
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
                <ul className="list-tight">
                  <li>Lifetime spend: {customer.lifetimeSpend}</li>
                  <li>Last visit: {customer.lastVisit}</li>
                  <li>Next action: {customer.nextAction}</li>
                </ul>
              </article>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Automations</span>
            <h2>Resend + Supabase workflows</h2>
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

        <div className="card accent-card">
          <div className="section-header left">
            <span className="eyebrow">Operator notes</span>
            <h2>Implementation details</h2>
          </div>

          <div className="stack">
            {notes.map((note) => (
              <div key={note.title} className="policy-item">
                <h3>{note.title}</h3>
                <p>{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
