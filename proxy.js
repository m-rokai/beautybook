// Next.js 16 renamed middleware.ts → proxy.ts. Auth.js's `auth` export,
// combined with the `authorized` callback in auth.js, enforces the /admin gate.
export { auth as proxy } from './auth';

export const config = {
  matcher: ['/admin/:path*'],
};
