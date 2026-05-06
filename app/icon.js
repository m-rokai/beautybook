import { ImageResponse } from 'next/og';

// Favicon: same purple gradient + serif "AL" mark used in the SiteHeader.
// Generated dynamically so any future brand-token change flows here.
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 38,
          fontWeight: 600,
          letterSpacing: '0.02em',
          // Pull the wordmark up a hair for optical centering of the slanted serifs.
          paddingBottom: 2,
        }}
      >
        AL
      </div>
    ),
    { ...size },
  );
}
