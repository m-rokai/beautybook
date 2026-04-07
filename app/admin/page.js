import { SiteHeader } from '../../components/SiteHeader';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import {
  dashboardStats,
  weeklyRevenue,
  customerRoster,
  retentionAutomations,
} from '../../lib/demo-data';

export default function AdminPage() {
  return (
    <main className="page-shell interior-shell">
      <SiteHeader />
      <section className="page-intro">
        <span className="eyebrow">Dashboard</span>
        <h1>Your business at a glance.</h1>
        <p>
          Track today's appointments, weekly revenue, and client retention — everything
          you need to run your practice.
        </p>
      </section>

      <AdminDashboard
        stats={dashboardStats}
        revenue={weeklyRevenue}
        customers={customerRoster}
        automations={retentionAutomations}
      />
    </main>
  );
}
