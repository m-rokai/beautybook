import { SiteHeader } from '../../../components/SiteHeader';
import { signIn, auth } from '../../../auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Admin sign in' };

export default async function AdminLoginPage({ searchParams }) {
  const session = await auth();
  if (session?.user?.isAdmin) redirect('/admin');

  const params = (await searchParams) || {};
  const error = typeof params.error === 'string' ? params.error : null;

  async function sendMagicLink(formData) {
    'use server';
    const email = formData.get('email');
    try {
      await signIn('nodemailer', {
        email,
        redirectTo: '/admin',
      });
    } catch (err) {
      // Duck-type instead of `instanceof AuthError` — bundled vs. peer copies
      // of next-auth in the build can yield two different AuthError classes,
      // making instanceof unreliable. Every Auth.js error sets `.type`; the
      // NEXT_REDIRECT throw that drives normal navigation does not.
      const authErrorType = err && typeof err === 'object' && err.type;
      if (authErrorType && typeof authErrorType === 'string') {
        redirect(`/admin/login?error=${encodeURIComponent(authErrorType)}`);
      }
      throw err;
    }
  }

  return (
    <main className="page-shell auth-shell">
      <SiteHeader />
      <section className="auth-card">
        <div className="auth-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </div>
        <span className="eyebrow">Admin access</span>
        <h1>Sign in.</h1>
        <p className="auth-meta">
          Enter your admin email — we&apos;ll send a one-time magic link.
        </p>

        <form action={sendMagicLink} className="auth-form" noValidate>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          {error ? (
            <p role="alert" className="auth-error">
              {error === 'AccessDenied'
                ? 'That email isn’t on the admin list.'
                : 'Something went wrong. Please try again.'}
            </p>
          ) : null}

          <button type="submit" className="button button-primary">
            Send magic link
          </button>
        </form>

        <p className="auth-fineprint">
          Links expire in 24 hours and can be used once.
        </p>
      </section>
    </main>
  );
}
