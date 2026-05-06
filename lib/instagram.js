// Instagram embed config.
//
// `featuredPostUrls` is the list of Instagram post URLs to display as native
// embeds (the real post, hosted by Instagram, with image + caption + like
// button). Add 4–6 of Ashley's best work for the section to fill in.
//
// To get a post URL: open the post on instagram.com, copy the URL bar, e.g.
//   https://www.instagram.com/p/Cabc123XyZ/
//
// Empty list → the section falls back to the on-brand gradient placeholder
// gallery so the layout never looks half-built.

export const INSTAGRAM_HANDLE = 'a.lacy_esthetics';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export const featuredPostUrls = [
  // 'https://www.instagram.com/p/SHORTCODE/',
];

// Legacy fallback gallery — used only when featuredPostUrls is empty.
export const instagramPosts = [
  { id: 'p1', image: null, caption: 'Customized facial · glow restored', href: INSTAGRAM_URL },
  { id: 'p2', image: null, caption: 'Pre-event glow up', href: INSTAGRAM_URL },
  { id: 'p3', image: null, caption: 'Brow shaping', href: INSTAGRAM_URL },
  { id: 'p4', image: null, caption: 'Vajacial · post-wax care', href: INSTAGRAM_URL },
  { id: 'p5', image: null, caption: 'HydroJelly mask', href: INSTAGRAM_URL },
  { id: 'p6', image: null, caption: 'Behind the scenes', href: INSTAGRAM_URL },
];
