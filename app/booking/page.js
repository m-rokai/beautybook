import { BookingExperience } from '../../components/booking/BookingExperience';
import { SiteHeader } from '../../components/SiteHeader';
import { services, slotGroups, bookingPolicies } from '../../lib/demo-data';

export default function BookingPage() {
  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">Guest booking flow</span>
        <h1>Book an esthetician appointment from your phone in under two minutes.</h1>
        <p>
          Select a service, choose a time, review cancellation terms, and lock in the appointment.
        </p>
      </section>

      <BookingExperience services={services} slotGroups={slotGroups} policies={bookingPolicies} />
    </main>
  );
}
