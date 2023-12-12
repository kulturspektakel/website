/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ['**/.*'],
  serverDependenciesToBundle: [
    /^remix-utils.*/,
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
  serverModuleFormat: 'cjs',
};
