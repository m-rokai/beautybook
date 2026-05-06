import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '../../components/SiteHeader';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import { auth, signOut } from '../../auth';
import { listActiveServices } from '../../lib/services-db';

export default async function AdminPage() {
  // Defense-in-depth: proxy.js already gates /admin, but a page-level check
  // prevents regressions if the matcher is ever changed.
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/admin/login');

  const catalog = await listActiveServices();

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">Dashboard</span>
        <h1>Your business at a glance.</h1>
        <p>
          Track today&apos;s appointments, weekly revenue, and client retention — everything
          you need to run your practice.
        </p>
        <div className="page-intro-toolbar">
          <Link href="/admin/services" className="signout-button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
            Manage services
          </Link>

          <form action={handleSignOut} className="page-intro-actions">
            <span className="page-intro-meta">
              {session.user.email}
            </span>
            <button type="submit" className="signout-button">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </section>

      <AdminDashboard catalog={catalog} />
    </main>
  );
}
