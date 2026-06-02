import emailVariants from 'tailwindcss-email-variants';
import {markdownToTxt} from 'markdown-to-txt';

/** @type {import('@maizzle/framework').Config} */
export default {
  build: {
    content: ['maizzle/templates/**/*.md'],
    static: {
      source: ['maizzle/assets/**/*'],
      // Repo-rooted public/maizzle/ — Vercel + Nitro serve everything in
      // public/ at the site root, so assets end up at
      // https://www.kulturspektakel.de/maizzle/<file>.
      destination: '../../public/maizzle',
    },
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
  baseURL: 'https://www.kulturspektakel.de/maizzle/',
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
