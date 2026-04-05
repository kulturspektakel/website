import {createServerFn} from '@tanstack/react-start';
import {setResponseHeader} from '@tanstack/react-start/server';
import {getCurrentEvent} from '../../utils/getCurrentEvent.server';

export const loadEvent = createServerFn({method: 'GET'}).handler(async () => {
  setResponseHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return {
    event: await getCurrentEvent(),
  };
});
