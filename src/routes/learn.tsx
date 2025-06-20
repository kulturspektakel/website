import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/learn')({
  beforeLoad: () => {
    throw redirect({href: 'https://www.youtube.com/watch?v=2arxBGrjBgI'});
  },
});
