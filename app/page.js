import Link from 'next/link';
import { CalendarClock, CreditCard, Gem, Sparkles, Users } from 'lucide-react';
import { services, dashboardStats, customerMoments, cancellationPolicy, platformPartners } from '../lib/demo-data';
import { getPlatformStatus } from '../lib/platform';
import { SiteHeader } from '../components/SiteHeader';

const iconMap = {
  facial: Sparkles,
  treatment: Gem,
  retention: Users,
  payment: CreditCard,
  calendar: CalendarClock,
};

export default function HomePage() {
  const platformStatus = getPlatformStatus();

  return (
    <main className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Muze Office amenity booking</span>
          <h1>
            A polished esthetician booking flow designed for guests, operators, and repeat revenue.
          </h1>
          <p className="hero-text">
            This MVP gives Muze Office a lightweight mobile-first beauty booking product with service
            selection, appointment management, cancellation policy support, Stripe payments, and a
            simple admin console for retention.
          </p>

          <div className="hero-actions">
            <Link href="/booking" className="button button-primary">
              Book a service
            </Link>
            <Link href="/admin" className="button button-secondary">
              Open admin dashboard
            </Link>
          </div>

          <div className="hero-highlights">
            <div className="metric-card">
              <span className="metric-label">Projected weekly revenue</span>
              <strong>{dashboardStats.weeklyRevenue}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Upcoming appointments</span>
              <strong>{dashboardStats.bookedThisWeek}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Retention sequence ready</span>
              <strong>{dashboardStats.retentionPipeline}</strong>
            </div>
          </div>
        </div>

        <div className="hero-panel card glass-card">
          <div className="panel-stack">
            <div>
              <span className="eyebrow">Core flow</span>
              <h2>Guest books in minutes</h2>
            </div>

            <div className="check-list">
              <div className="check-item">
                <span className="check-badge">1</span>
                <p>Choose a service, see duration and pricing, then pick a slot.</p>
              </div>
              <div className="check-item">
                <span className="check-badge">2</span>
                <p>Capture customer details, consent, and cancellation policy terms.</p>
              </div>
              <div className="check-item">
                <span className="check-badge">3</span>
                <p>Process payment with Stripe, sync records to Supabase, and send confirmations with Resend.</p>
              </div>
            </div>

            <div className="platform-grid">
              {platformPartners.map((partner) => (
                <div key={partner.name} className="partner-chip">
                  <span>{partner.name}</span>
                  <small>{platformStatus[partner.key] ? 'Connected' : 'Needs env'}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <span className="eyebrow">Experience pillars</span>
          <h2>Built for guest delight and operator control</h2>
        </div>

        <div className="feature-grid">
          {[
            {
              title: 'Service-led booking',
              body: 'Guests choose the exact treatment, view duration, deposit rules, and preferred aftercare notes before they confirm.',
              icon: 'facial',
            },
            {
              title: 'Calendar clarity',
              body: 'Simple slot selection keeps the flow fast on mobile while giving the esthetician a clean daily schedule.',
              icon: 'calendar',
            },
            {
              title: 'Cancellation protection',
              body: 'Flexible policy windows let Muze Office charge cancellation fees or enforce deposit forfeiture when needed.',
              icon: 'payment',
            },
            {
              title: 'Retention-first CRM',
              body: 'The admin view tracks lifetime spend, loyalty stage, and follow-up moments so customers come back.',
              icon: 'retention',
            },
          ].map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <article key={feature.title} className="card feature-card">
                <div className="icon-pill">
                  <Icon size={20} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section split-section">
        <div className="card">
          <div className="section-header left">
            <span className="eyebrow">Services</span>
            <h2>Example esthetician menu</h2>
          </div>

          <div className="service-list">
            {services.map((service) => (
              <div key={service.id} className="service-row">
                <div>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                </div>
                <div className="service-meta">
                  <span>{service.duration}</span>
                  <strong>{service.price}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card accent-card">
          <div className="section-header left">
            <span className="eyebrow">Cancellation terms</span>
            <h2>Clear policies protect the provider and set expectations early</h2>
          </div>

          <div className="policy-stack">
            {cancellationPolicy.map((policy) => (
              <div key={policy.title} className="policy-item">
                <h3>{policy.title}</h3>
                <p>{policy.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <span className="eyebrow">Retention moments</span>
          <h2>Customer marketing hooks baked into the admin workflow</h2>
        </div>

        <div className="feature-grid">
          {customerMoments.map((moment) => (
            <article key={moment.title} className="card">
              <h3>{moment.title}</h3>
              <p>{moment.copy}</p>
              <small>{moment.trigger}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div>
          <span className="eyebrow">Ready to wire the stack</span>
          <h2>Supabase stores bookings, Stripe charges guests, Resend handles confirmations, and Vercel ships it.</h2>
        </div>

        <div className="hero-actions">
          <Link href="/booking" className="button button-primary">
            Preview booking flow
          </Link>
          <Link href="/portal" className="button button-secondary">
            Preview customer portal
          </Link>
        </div>
      </section>
    </main>
  );
}
