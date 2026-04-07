import { SquareClient, SquareEnvironment } from 'square';

let cachedClient = null;

export function getSquareClient() {
  if (cachedClient) return cachedClient;

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set');
  }

  const environment =
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;

  cachedClient = new SquareClient({ token, environment });
  return cachedClient;
}

// Safely serialize Square responses that contain BigInt money amounts.
export function serializeSquare(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}
