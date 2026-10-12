import { defineConfig } from 'astro/config';

export default defineConfig({
  trailingSlash: 'always',
  // The old separate pages now live on one Legal page.
  redirects: {
    '/privacy/': '/legal/',
    '/terms/': '/legal/',
  },
});
