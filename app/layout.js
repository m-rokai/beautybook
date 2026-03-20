import './globals.css';

export const metadata = {
  title: 'Muze Office Beauty Booking',
  description:
    'Mobile-first esthetician booking experience for the Muze Office amenity ecosystem.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
