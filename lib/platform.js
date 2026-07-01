export function getPlatformStatus() {
  return {
    database: Boolean(process.env.DATABASE_URL),
    square: Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID),
    squareEnvironment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    squareWebhook: Boolean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY),
    auth: Boolean(process.env.AUTH_SECRET && process.env.AUTH_ALLOWED_ADMIN_EMAILS),
    mail: Boolean(
      process.env.EMAIL_SERVER_HOST &&
      process.env.EMAIL_SERVER_USER &&
      process.env.EMAIL_SERVER_PASSWORD,
    ),
    vercel: Boolean(process.env.VERCEL || process.env.VERCEL_URL),
  };
}
