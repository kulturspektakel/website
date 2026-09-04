import {createFileRoute, redirect} from '@tanstack/react-router';

// Off-site short URL for the workshop video. See vegan.tsx — production answers
// this at the edge via the `routeRules` entry in vite.config.ts; this file covers
// `vite dev`. Unlike its siblings the destination is a bare `href`, so nothing
// type-checks it against the config entry — keep the two in sync by hand.
export const Route = createFileRoute('/_main/learn')({
  beforeLoad: () => {
    throw redirect({href: 'https://youtu.be/EakoNs1PP1c'});
  },
});
