import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '../../../components/SiteHeader';
import { ServiceEditor } from '../../../components/admin/ServiceEditor';
import { auth } from '../../../auth';
import { listAllServices, SERVICE_CATEGORIES } from '../../../lib/services-db';

export const metadata = { title: 'Service editor' };

export default async function AdminServicesPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/admin/login');

  const services = await listAllServices();

  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">Catalog</span>
        <h1>Edit your services.</h1>
        <p>
          Update prices, durations, descriptions, or take a service offline. Changes go live
          on the booking page immediately. Old bookings keep resolving to their original
          service even after archiving.
        </p>
        <Link href="/admin" className="signout-button" style={{ marginTop: 16 }}>
          ← Back to dashboard
        </Link>
      </section>

      <ServiceEditor initialServices={services} categories={SERVICE_CATEGORIES} />
    </main>
  );
}
