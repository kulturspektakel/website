import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/lautstärke')({
  beforeLoad: () => {
    throw redirect({to: '/lautstaerke'});
  },
});
