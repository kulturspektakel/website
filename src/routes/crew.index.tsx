import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/crew/')({
  beforeLoad: () => {
    throw redirect({href: 'https://crew.kulturspektakel.de'});
  },
});
