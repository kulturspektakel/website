import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/lineup/')({
  loader: async ({context}) => {
    throw redirect({
      to: '/lineup/$year',
      params: {
        year: context.event.start.getFullYear().toString(),
      },
    });
  },
});
