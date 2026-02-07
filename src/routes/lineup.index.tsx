import {createFileRoute, redirect} from '@tanstack/react-router';
import {firstEventWithBands} from '../server/routes/lineup.index';

export const Route = createFileRoute('/lineup/')({
  loader: async () => {
    const firstEvent = await firstEventWithBands();

    throw redirect({
      to: '/lineup/$year',
      params: {
        year: firstEvent.start.getFullYear().toString(),
      },
    });
  },
});
