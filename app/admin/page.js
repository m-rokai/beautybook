import { SiteHeader } from '../../components/SiteHeader';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import {
  dashboardStats,
  todaysAppointments,
  weeklyRevenue,
  customerRoster,
  retentionAutomations,
  operationalNotes,
} from '../../lib/demo-data';

export default function AdminPage() {
  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">Esthetician admin console</span>
        <h1>Track bookings, revenue, cancellations, and customer retention in one clean dashboard.</h1>
        <p>
          Built to be simple enough for one operator while still fitting the broader Muze Office amenity stack.
        </p>
      </section>

      <AdminDashboard
        stats={dashboardStats}
        appointments={todaysAppointments}
        revenue={weeklyRevenue}
        customers={customerRoster}
        automations={retentionAutomations}
        notes={operationalNotes}
      />
    </main>
  );
}
