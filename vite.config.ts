import path from 'node:path';
import {defineConfig, type Plugin} from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import {tanstackStart} from '@tanstack/react-start/plugin/vite';
import {nitroV2Plugin} from '@tanstack/nitro-v2-vite-plugin';
import viteReact from '@vitejs/plugin-react';

const prismaBrowserPath = path.resolve(
  __dirname,
  'src/generated/prisma/browser.ts',
);
const prismaClientModulePath = path.resolve(
  __dirname,
  'src/utils/prismaClient.ts',
);

// Redirect Prisma server-side imports to browser-safe versions in client builds.
// The Prisma client uses Node.js APIs that can't be bundled for the browser.
function prismaBrowserResolve(): Plugin {
  return {
    name: 'prisma-browser-resolve',
    enforce: 'pre',
    resolveId(id, importer, options) {
      if (options.ssr) return;
      // Generated Prisma client → browser-safe version (enums, types only)
      // Skip for prismaClient.ts — it's server-only and handled by the load hook
      if (
        id.endsWith('/generated/prisma/client') &&
        !importer?.endsWith('/prismaClient.ts')
      ) {
        return prismaBrowserPath;
      }
      // Prisma runtime → browser-safe runtime
      if (id === '@prisma/client/runtime/client') {
        return path.resolve(
          __dirname,
          'node_modules/@prisma/client/runtime/index-browser.mjs',
        );
      }
    },
    load(id) {
      // In the client build, prismaClient.ts gets processed even though it's
      // server-only. Return an empty stub so it doesn't pull in Node.js deps.
      // The `resolveId` hook above already handles the ssr check, so if this
      // module's import was redirected (to browser.ts), we're in a client build.
      if (
        id === prismaClientModulePath &&
        this.environment?.name === 'client'
      ) {
        return 'export const prismaClient = null;';
      }
    },
  };
}

export default defineConfig({
  plugins: [
    prismaBrowserResolve(),
    tsConfigPaths(),
    tanstackStart(),
    nitroV2Plugin({
      preset: 'vercel',
    }),
    viteReact(),
  ],
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
