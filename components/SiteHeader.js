import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand-block">
        <div className="brand-mark">AL</div>
        <div className="brand-copy">
          <span>Ashley Lacy</span>
          <strong>Aesthetics</strong>
        </div>
      </Link>

      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="nav-link" href="/">
          Home
        </Link>
        <Link className="nav-link" href="/booking">
          Book Now
        </Link>
        <Link className="nav-link" href="/portal">
          My Appointment
        </Link>
        <Link className="nav-link" href="/admin">
          Dashboard
        </Link>
      </nav>
    </header>
  );
}
