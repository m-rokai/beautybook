import { BookingExperience } from '../../components/booking/BookingExperience';
import { SiteHeader } from '../../components/SiteHeader';
import { serviceCategories, addOns, bookingPolicies } from '../../lib/demo-data';

export default function BookingPage() {
  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">Book your treatment</span>
        <h1>Choose your service, pick a time, and you're all set.</h1>
        <p>
          Select from our treatment menu, find a slot that works for you, and secure your
          appointment in just a few taps.
        </p>
      </section>

      <BookingExperience serviceCategories={serviceCategories} addOns={addOns} policies={bookingPolicies} />
    </main>
  );
}
