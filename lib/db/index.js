import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Cache the client across hot reloads in dev and warm Lambda invocations in prod.
const globalForDb = globalThis;

// postgres-js is lazy — it doesn't open the TCP connection until the first
// query — so we can safely construct the client with a placeholder URL when
// DATABASE_URL is missing at module-load time. This matters because Vercel's
// `next build` page-data collection imports route modules even though it
// doesn't run them, and a module-level throw here would crash the build for
// any route that transitively imports db. Real queries still fail loudly: the
// fake URL won't resolve, so postgres-js surfaces a connection error at use.
const connectionString =
  process.env.DATABASE_URL || 'postgres://unset:unset@unset:5432/unset';

const client =
  globalForDb.__beautyBookingPg ??
  postgres(connectionString, {
    prepare: false, // safer with pgbouncer pooled connections
  });

if (process.env.NODE_ENV !== 'production' && process.env.DATABASE_URL) {
  globalForDb.__beautyBookingPg = client;
}

export const db = drizzle(client, { schema });
export { schema };
