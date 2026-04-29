import Link from 'next/link';
import { SiteHeader } from '../../../../components/SiteHeader';

export const metadata = { title: 'Check your email' };

export default function VerifyRequestPage() {
  return (
    <main className="page-shell auth-shell">
      <SiteHeader />
      <section className="auth-card">
        <div className="auth-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m4 7 8 6 8-6" />
            <path d="m9 13 2.2 2.2L16 11" />
          </svg>
        </div>
        <span className="eyebrow">Check your inbox</span>
        <h1>Magic link sent.</h1>
        <p className="auth-meta">
          Open the link on this device to finish signing in. It expires in 24 hours.
        </p>

        <p className="auth-fineprint">
          Didn’t get it?{' '}
          <Link className="auth-secondary-link" href="/admin/login">
            Try a different email →
          </Link>
        </p>
      </section>
    </main>
  );
}
