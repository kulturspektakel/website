import {createServerFn} from '@tanstack/react-start';
import {directusImageConnection} from '../../utils/directusImage.server';

export const loadMoreImages = createServerFn()
  .inputValidator(
    (params: {limit: number; offset: number; eventId: string}) => params,
  )
  .handler(async ({data: {eventId, offset, limit}}) => {
    return await directusImageConnection('Event', eventId, limit, offset);
  });
