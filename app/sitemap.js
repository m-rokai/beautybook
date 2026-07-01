import { SITE_URL } from '../lib/site';

export default function sitemap() {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/booking`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/portal`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
