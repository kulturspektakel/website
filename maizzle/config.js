import 'dotenv/config';
import emailVariants from 'tailwindcss-email-variants';
import {markdownToTxt} from 'markdown-to-txt';

if (!process.env.SITE_URL) {
  throw new Error(
    'SITE_URL is not set — maizzle needs it to build absolute asset URLs. ' +
      'Run `yarn sync:gcp-env` or copy .env from a teammate.',
  );
}

/** @type {import('@maizzle/framework').Config} */
export default {
  build: {
    content: ['maizzle/templates/**/*.md'],
    // Assets live directly in public/maizzle/ — Vercel + Nitro serve
    // everything in public/ at the site root, so they're already at
    // https://www.kulturspektakel.de/maizzle/<file> without any copy step.
    output: {
      path: 'maizzle/generated',
      from: 'maizzle/templates',
      extension: 'ts',
    },
  },
  components: {
    root: 'maizzle',
    folders: ['components'],
  },
  baseURL: `${process.env.SITE_URL}/maizzle/`,
  css: {
    purge: true,
    inline: true,
    tailwind: {
      plugins: [emailVariants],
      content: [
        'maizzle/templates/**/*.md',
        'maizzle/components/**/*.html',
      ],
      theme: {
        extend: {
          colors: {
            brand: {
              500: '#E12E2E',
            },
          },
        },
      },
    },
  },
  beforeRender: async ({html, config}) => {
    config._text = markdownToTxt(html).trim();
    return `<x-main><md>${html}</md></x-main>`;
  },
};
