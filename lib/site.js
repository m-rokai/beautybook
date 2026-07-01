// Canonical site constants shared by metadata, robots, sitemap, and JSON-LD.
// NEXT_PUBLIC_APP_URL is localhost in dev and the deployed URL in production —
// the fallback keeps metadata sane if the env var is ever missing.
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://beauty-booking-three.vercel.app';

export const SITE_NAME = 'Ashley Lacy Esthetics';

export const SITE_DESCRIPTION =
  'Book facials, waxing, and body treatments with Ashley Lacy Esthetics in Las Vegas. ' +
  'Easy online booking — secure your appointment with a deposit in under two minutes.';

export const BUSINESS_ADDRESS = {
  streetAddress: '6860 Bermuda Rd, Suite 200',
  addressLocality: 'Las Vegas',
  addressRegion: 'NV',
  postalCode: '89119',
  addressCountry: 'US',
};
