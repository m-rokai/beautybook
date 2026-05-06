// Instagram gallery — Ashley's curated posts.
//
// To swap a placeholder for a real photo:
//   1. Drop the image into /public/instagram/ (or anywhere in /public)
//   2. Replace `image: null` with `image: '/instagram/<filename>.jpg'`
//   3. Update `caption` to match the post's caption (or anything short)
//   4. Update `href` to the actual post URL if you want each tile to deep-link
//      to its own post; otherwise every tile links to her profile.
//
// Defaults: tiles without an image render an on-brand placeholder card so
// the section never looks half-built.

export const INSTAGRAM_HANDLE = 'a.lacy_esthetics';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export const instagramPosts = [
  { id: 'p1', image: null, caption: 'Customized facial · glow restored', href: INSTAGRAM_URL },
  { id: 'p2', image: null, caption: 'Pre-event glow up', href: INSTAGRAM_URL },
  { id: 'p3', image: null, caption: 'Brow shaping', href: INSTAGRAM_URL },
  { id: 'p4', image: null, caption: 'Vajacial · post-wax care', href: INSTAGRAM_URL },
  { id: 'p5', image: null, caption: 'HydroJelly mask', href: INSTAGRAM_URL },
  { id: 'p6', image: null, caption: 'Behind the scenes', href: INSTAGRAM_URL },
];
