import Link from 'next/link';
import { CalendarClock, CreditCard, Gem, Sparkles, Instagram, Tag } from 'lucide-react';
import { addOns, cancellationPolicy } from '../lib/demo-data';
import { listActiveServiceCategories } from '../lib/services-db';
import { SiteHeader } from '../components/SiteHeader';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, GROUPON_URL } from '../lib/instagram';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, BUSINESS_ADDRESS } from '../lib/site';

export const metadata = {
  alternates: { canonical: '/' },
};

// Structured data so Google can show the business card (hours, address,
// booking link) directly in search results.
const businessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BeautySalon',
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  address: {
    '@type': 'PostalAddress',
    ...BUSINESS_ADDRESS,
  },
  containedInPlace: {
    '@type': 'Place',
    name: 'Muze Office',
    url: 'https://muzeoffice.com',
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
  sameAs: [INSTAGRAM_URL],
  potentialAction: {
    '@type': 'ReserveAction',
    target: `${SITE_URL}/booking`,
  },
};

const features = [
  {
    title: 'Curated Treatments',
    body: 'Browse our full menu with transparent pricing, duration, and what to expect.',
    Icon: Sparkles,
  },
  {
    title: 'Easy Scheduling',
    body: 'Pick your preferred day and time in seconds — built for mobile.',
    Icon: CalendarClock,
  },
  {
    title: 'Secure Payments',
    body: 'Pay your deposit or full amount securely through Square.',
    Icon: CreditCard,
  },
  {
    title: 'Flexible Policies',
    body: 'Reschedule or cancel with clear terms — no surprises.',
    Icon: Gem,
  },
];

export default async function HomePage() {
  const serviceCategories = await listActiveServiceCategories();
  return (
    <main className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Static, trusted data only; escape "<" per the Next.js JSON-LD guidance.
          __html: JSON.stringify(businessJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Ashley Lacy Esthetics</span>
          <h1>Your skin deserves <em>expert</em> care.</h1>
          <p className="hero-text">
            Professional facials, waxing, body treatments, and lash services
            tailored to you. Book online in under two minutes.
          </p>

          <div className="hero-actions">
            <Link href="/booking" className="button button-primary">
              Book an Appointment
            </Link>
            <Link href="/portal" className="button button-secondary">
              Manage My Booking
            </Link>
          </div>

          <div className="hero-highlights">
            <div className="metric-card">
              <span className="metric-label">Open</span>
              <strong>7 days a week</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Inside</span>
              <strong>Muze Office</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Booking</span>
              <strong>Deposit at checkout</strong>
            </div>
          </div>
        </div>

        <div className="hero-panel card glass-card">
          <div className="panel-stack">
            <div>
              <span className="eyebrow">How it works</span>
              <h2>Book in 3 steps</h2>
            </div>

            <div className="check-list">
              <div className="check-item">
                <span className="check-badge">1</span>
                <p>Choose your treatment and see pricing, duration, and what's included.</p>
              </div>
              <div className="check-item">
                <span className="check-badge">2</span>
                <p>Pick a date and time that works for your schedule.</p>
              </div>
              <div className="check-item">
                <span className="check-badge">3</span>
                <p>Confirm your details, pay your deposit, and you're all set.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <span className="eyebrow">Why book with us</span>
          <h2>A booking experience designed around you</h2>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="card feature-card">
              <div className="icon-pill">
                <feature.Icon size={20} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Full Service Menu ── */}
      <section className="section">
        <div className="section-header">
          <span className="eyebrow">Our menu</span>
          <h2>Treatments & Services</h2>
        </div>

        <div className="menu-grid">
          {serviceCategories.map((category) => (
            <div key={category.id} className="card menu-category">
              <h3 className="menu-category-title">{category.name}</h3>
              <div className="menu-items">
                {category.services.map((service) => (
                  <div key={service.id} className="menu-item">
                    <div className="menu-item-top">
                      <span className="menu-item-name">{service.name}</span>
                      <span className="menu-item-dots" />
                      <span className="menu-item-price">{service.price}</span>
                    </div>
                    <span className="menu-item-duration">{service.duration}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add-Ons card */}
          <div className="card menu-category addon-category">
            <h3 className="menu-category-title">Add-Ons</h3>
            <div className="menu-items">
              {addOns.map((addon) => (
                <div key={addon.id} className="menu-item">
                  <div className="menu-item-top">
                    <span className="menu-item-name">{addon.name}</span>
                    <span className="menu-item-dots" />
                    <span className="menu-item-price">{addon.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Find me online ── */}
      <section className="section social-section">
        <div className="section-header">
          <span className="eyebrow">Find me online</span>
          <h2>See more of Ashley&rsquo;s work.</h2>
          <p className="social-subhead">
            Follow along on Instagram for before/afters and aftercare tips, or grab a deal on Groupon.
          </p>
        </div>

        <div className="social-buttons">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener"
            className="social-button social-button-instagram"
          >
            <span className="social-button-icon" aria-hidden="true">
              <Instagram size={22} strokeWidth={1.75} />
            </span>
            <span className="social-button-body">
              <small>Instagram</small>
              <strong>@{INSTAGRAM_HANDLE}</strong>
            </span>
          </a>
          <a
            href={GROUPON_URL}
            target="_blank"
            rel="noopener"
            className="social-button social-button-groupon"
          >
            <span className="social-button-icon" aria-hidden="true">
              <Tag size={22} strokeWidth={1.75} />
            </span>
            <span className="social-button-body">
              <small>Groupon</small>
              <strong>Find Ashley&rsquo;s deals</strong>
            </span>
          </a>
        </div>
      </section>

      {/* ── Cancellation Policy ── */}
      <section className="section split-section">
        <div className="card accent-card">
          <div className="section-header left">
            <span className="eyebrow">Good to know</span>
            <h2>Cancellation Policy</h2>
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

        <div className="cta-side">
          <div className="card glass-card" style={{ height: '100%', display: 'grid', alignContent: 'center', gap: 20 }}>
            <span className="eyebrow">Ready?</span>
            <h2>Book your appointment today.</h2>
            <div className="hero-actions">
              <Link href="/booking" className="button button-primary">
                Book Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Location ── */}
      <section className="section">
        <div className="card location-card">
          <div className="section-header left">
            <span className="eyebrow">Find us</span>
            <h2>Inside Muze Office.</h2>
          </div>
          <address className="location-block">
            <strong>
              <a
                href="https://muzeoffice.com"
                target="_blank"
                rel="noopener"
                className="brand-link"
              >
                Muze Office
              </a>
            </strong>
            <p>6860 Bermuda Rd, Suite 200</p>
            <p>Las Vegas, NV 89119</p>
          </address>
          <div className="hero-actions">
            <a
              href="https://www.google.com/maps/search/?api=1&query=Muze+Office+6860+Bermuda+Rd+Ste+200+Las+Vegas+NV+89119"
              target="_blank"
              rel="noreferrer"
              className="button button-secondary"
            >
              Open in Maps
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="site-footer-row">
          <div className="brand-block">
            <div className="brand-mark">AL</div>
            <div className="brand-copy">
              <span>Ashley Lacy</span>
              <strong>Esthetics</strong>
            </div>
          </div>
          <div className="site-footer-links">
            <Link href="/booking" className="nav-link">Book</Link>
            <Link href="/portal" className="nav-link">My appointment</Link>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="nav-link">
              <Instagram size={14} aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Instagram
            </a>
            <a href={GROUPON_URL} target="_blank" rel="noopener" className="nav-link">
              <Tag size={14} aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Groupon
            </a>
          </div>
        </div>
        <p className="site-footer-meta">
          Inside <a href="https://muzeoffice.com" target="_blank" rel="noopener" className="brand-link">Muze Office</a> · 6860 Bermuda Rd Ste 200, Las Vegas NV 89119
        </p>
      </footer>
    </main>
  );
}
