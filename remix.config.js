/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  serverDependenciesToBundle: [
    '@apollo/client',
    'ts-invariant',
    '@wry/equality',
    'zen-observable-ts',
    '@wry/trie',
    '@wry/context',
    'hex-rgb',
    'chakra-ui-steps',
    'react-photoswipe-gallery',
    'photoswipe',
  ],
  future: {
    v2_routeConvention: true,
    v2_errorBoundary: true,
    v2_meta: true,
  },
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "build/index.js",
  // publicPath: "/build/",
};
