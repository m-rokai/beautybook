import { config as dotenvConfig } from 'dotenv';

// Load .env.local first (Next.js convention for local secrets), then fall back to .env.
dotenvConfig({ path: '.env.local' });
dotenvConfig({ path: '.env' });

/** @type {import('drizzle-kit').Config} */
export default {
  schema: './lib/db/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Drizzle Kit needs a direct (unpooled) connection for DDL operations.
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
};
