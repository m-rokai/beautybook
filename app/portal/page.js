import { SiteHeader } from '../../components/SiteHeader';
import { CustomerPortal } from '../../components/portal/CustomerPortal';
import { customerAppointments, slotGroups, bookingPolicies } from '../../lib/demo-data';

export default function PortalPage() {
  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">Customer self-service</span>
        <h1>Let guests reschedule or cancel appointments without chasing your team.</h1>
        <p>
          A lightweight portal keeps the experience modern while still respecting cancellation fee rules.
        </p>
      </section>

      <CustomerPortal appointments={customerAppointments} slotGroups={slotGroups} policies={bookingPolicies} />
    </main>
  );
}
