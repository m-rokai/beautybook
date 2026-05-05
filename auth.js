import NextAuth from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './lib/db';
import { users, accounts, sessions, verificationTokens } from './lib/db/auth-schema';

// Each entry is either an exact email ("ashley@gmail.com") OR a domain match
// written with a leading "@" ("@muzeoffice.com" → any address at that domain).
const allowedAdminRules = (process.env.AUTH_ALLOWED_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const allowedAdminEmails = allowedAdminRules.filter((r) => !r.startsWith('@'));
const allowedAdminDomains = allowedAdminRules
  .filter((r) => r.startsWith('@'))
  .map((r) => r.slice(1));

function isAdminEmail(email) {
  if (!email || allowedAdminRules.length === 0) return false;
  const normalized = email.toLowerCase().trim();
  if (allowedAdminEmails.includes(normalized)) return true;
  const at = normalized.lastIndexOf('@');
  if (at < 0) return false;
  const domain = normalized.slice(at + 1);
  return allowedAdminDomains.includes(domain);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT sessions keep route gates stateless — the sessions table exists
  // for adapter compatibility but isn't read on each request.
  session: { strategy: 'jwt' },
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
        port: Number(process.env.EMAIL_SERVER_PORT || 465),
        secure: Number(process.env.EMAIL_SERVER_PORT || 465) === 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: '/admin/login',
    verifyRequest: '/admin/login/verify',
    error: '/admin/login',
  },
  callbacks: {
    // Hard gate: unknown emails can't even complete the magic-link flow.
    async signIn({ user }) {
      return isAdminEmail(user?.email);
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      token.isAdmin = isAdminEmail(token.email);
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.isAdmin = Boolean(token.isAdmin);
      return session;
    },
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      // Allow the sign-in page itself through so unauth'd users can reach it.
      if (pathname.startsWith('/admin/login')) return true;
      if (pathname.startsWith('/admin')) return Boolean(session?.user?.isAdmin);
      return true;
    },
  },
});
