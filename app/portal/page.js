import { SiteHeader } from '../../components/SiteHeader';
import { CustomerPortal } from '../../components/portal/CustomerPortal';
import { bookingPolicies } from '../../lib/demo-data';

export default function PortalPage() {
  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">My appointment</span>
        <h1>Need to reschedule? No problem.</h1>
        <p>
          Look up your booking, reschedule to a different time, or cancel if plans change.
        </p>
      </section>

      <CustomerPortal policies={bookingPolicies} />
    </main>
  );
}
