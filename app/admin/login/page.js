import { SiteHeader } from '../../../components/SiteHeader';
import { signIn, auth } from '../../../auth';
import { AuthError } from 'next-auth';
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
      // Auth.js v5 throws AuthError for things like AccessDenied — translate
      // those into a graceful query-param redirect. Anything else (including
      // the NEXT_REDIRECT signal that drives normal navigation) gets re-thrown.
      if (err instanceof AuthError) {
        const code = err.type || 'CredentialsSignin';
        redirect(`/admin/login?error=${encodeURIComponent(code)}`);
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
