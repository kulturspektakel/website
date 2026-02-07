import {createServerFn} from '@tanstack/react-start';
import {getCurrentEvent} from '../../utils/getCurrentEvent.server';

export const beforeLoad = createServerFn()
  // .middleware([staticFunctionMiddleware])
  .handler(async () => ({
    event: await getCurrentEvent(),
  }));
