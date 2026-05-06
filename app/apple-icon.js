import { ImageResponse } from 'next/og';

// 180×180 home-screen icon for iOS / iPadOS. Matches the favicon and the
// in-app SiteHeader brand-mark exactly.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #b86dff 0%, #8a3fd0 100%)',
          color: '#0c0a10',
          fontFamily: 'serif',
          fontSize: 100,
          fontWeight: 600,
          letterSpacing: '0.02em',
          paddingBottom: 6,
        }}
      >
        AL
      </div>
    ),
    { ...size },
  );
}
