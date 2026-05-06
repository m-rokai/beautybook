'use client';

import { useEffect, useRef } from 'react';

// Renders Instagram's official post embeds. Each URL becomes a
// <blockquote class="instagram-media"> that Instagram's embed.js swaps for
// a hosted iframe (real image, caption, like button, comments link).
//
// No API token, no rotation, no third-party widget. Just public post URLs.
export function InstagramEmbeds({ urls }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!urls || urls.length === 0) return;
    if (typeof window === 'undefined') return;

    const SCRIPT_ID = 'instagram-embed-script';

    const processEmbeds = () => {
      if (window.instgrm?.Embeds?.process) {
        window.instgrm.Embeds.process();
      }
    };

    // If the script is already loaded (e.g. from a prior render), just re-run
    // the processor against the freshly-mounted blockquotes.
    if (window.instgrm) {
      processEmbeds();
      return;
    }

    // First mount — inject the script. Instagram's embed.js auto-processes
    // every blockquote it finds when it loads.
    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.onload = processEmbeds;
      document.body.appendChild(script);
    } else if (script.dataset.loaded === 'true') {
      processEmbeds();
    } else {
      script.addEventListener('load', processEmbeds, { once: true });
    }
  }, [urls]);

  if (!urls || urls.length === 0) return null;

  return (
    <div className="ig-embeds" ref={ref}>
      {urls.map((url) => (
        <blockquote
          key={url}
          className="instagram-media"
          data-instgrm-permalink={url}
          data-instgrm-version="14"
          data-instgrm-captioned
          style={{
            background: '#fff',
            border: 0,
            borderRadius: 14,
            boxShadow: 'var(--shadow-md)',
            margin: 0,
            padding: 0,
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            View on Instagram
          </a>
        </blockquote>
      ))}
    </div>
  );
}
