import './globals.css';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '../lib/site';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Book Your Glow`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'esthetician Las Vegas',
    'facials Las Vegas',
    'waxing Las Vegas',
    'body treatments',
    'Ashley Lacy Esthetics',
  ],
  openGraph: {
    title: `${SITE_NAME} | Book Your Glow`,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} | Book Your Glow`,
    description: SITE_DESCRIPTION,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c0a10',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
