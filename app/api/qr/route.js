import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

// GET /api/qr?url=...&size=1024&format=png|svg
//
// Defaults: encode the booking URL as a 512×512 PNG. Use ?format=svg for
// vector output (lossless at any size, smaller download). Error correction
// is fixed at level H so any printed copy survives surface scuffs / logo
// overlays.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fallback = `${process.env.NEXT_PUBLIC_APP_URL || 'https://beauty-booking-three.vercel.app'}/booking`;
  const url = searchParams.get('url') || fallback;
  const size = Math.min(2048, Math.max(128, Number(searchParams.get('size') || 512)));
  const format = searchParams.get('format') === 'svg' ? 'svg' : 'png';

  const opts = {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
    color: { dark: '#7c5cc7ff', light: '#ffffffff' },
  };

  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, immutable',
          'Content-Disposition': 'inline; filename="ashley-lacy-booking.svg"',
        },
      });
    }
    const buffer = await QRCode.toBuffer(url, opts);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
        'Content-Disposition': 'inline; filename="ashley-lacy-booking.png"',
      },
    });
  } catch (err) {
    console.error('[qr] generation failed', err);
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 });
  }
}
