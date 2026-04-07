import './globals.css';

export const metadata = {
  title: 'Ashley Lacy Aesthetics | Book Your Glow',
  description:
    'Book facials, skin treatments, and beauty services with Ashley Lacy Aesthetics. Easy online booking with flexible scheduling.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
