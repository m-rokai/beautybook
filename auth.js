import NextAuth from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './lib/db';
import { users, accounts, sessions, verificationTokens } from './lib/db/auth-schema';

const allowedAdminEmails = (process.env.AUTH_ALLOWED_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  if (!email || allowedAdminEmails.length === 0) return false;
  return allowedAdminEmails.includes(email.toLowerCase());
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
