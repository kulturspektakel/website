import {defineConfig} from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import {tanstackStart} from '@tanstack/react-start/plugin/vite';

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      target: 'vercel',
    }),
  ],
  resolve: {
    alias: {
      '.prisma/client/index-browser':
        './node_modules/.prisma/client/index-browser.js',
    },
  },
  ssr: {
    noExternal: ['@apollo/client', 'iban-ts'],
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
  },
});
