import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Cache the client across hot reloads in dev and warm Lambda invocations in prod.
const globalForDb = globalThis;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client =
  globalForDb.__beautyBookingPg ??
  postgres(connectionString, {
    prepare: false, // safer with pgbouncer pooled connections
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__beautyBookingPg = client;
}

export const db = drizzle(client, { schema });
export { schema };
