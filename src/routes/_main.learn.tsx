import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/_main/learn')({
  beforeLoad: () => {
    throw redirect({href: 'https://youtu.be/EakoNs1PP1c'});
  },
});
