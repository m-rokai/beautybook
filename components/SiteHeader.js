import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="brand-block">
        <div className="brand-mark">M</div>
        <div className="brand-copy">
          <span>Muze Office</span>
          <strong>Beauty Booking</strong>
        </div>
      </div>

      <nav className="site-nav" aria-label="Primary navigation">
        <Link className="nav-link" href="/">
          Overview
        </Link>
        <Link className="nav-link" href="/booking">
          Booking
        </Link>
        <Link className="nav-link" href="/portal">
          Customer portal
        </Link>
        <Link className="nav-link" href="/admin">
          Admin
        </Link>
      </nav>
    </header>
  );
}
