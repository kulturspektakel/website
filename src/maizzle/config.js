import emailVariants from 'tailwindcss-email-variants';
import {markdownToTxt} from 'markdown-to-txt';

/** @type {import('@maizzle/framework').Config} */
export default {
  build: {
    content: ['src/maizzle/templates/**/*.md'],
    static: {
      source: ['src/maizzle/assets/**/*'],
      // Repo-rooted public/maizzle/ — Vercel + Nitro serve everything in
      // public/ at the site root, so assets end up at
      // https://www.kulturspektakel.de/maizzle/<file>.
      destination: '../../../public/maizzle',
    },
    output: {
      path: 'src/maizzle/generated',
      from: 'src/maizzle/templates',
      extension: 'ts',
    },
  },
  components: {
    root: 'src/maizzle',
    folders: ['components'],
  },
  baseURL: 'https://www.kulturspektakel.de/maizzle/',
  css: {
    purge: true,
    inline: true,
    tailwind: {
      plugins: [emailVariants],
      content: [
        'src/maizzle/templates/**/*.md',
        'src/maizzle/components/**/*.html',
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
