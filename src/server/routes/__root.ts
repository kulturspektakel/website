import {createServerFn} from '@tanstack/react-start';
import {getCurrentEvent} from '../../utils/getCurrentEvent.server';
// import {staticFunctionMiddleware} from '@tanstack/start-static-server-functions';

export const beforeLoad = createServerFn()
  // .middleware([staticFunctionMiddleware])
  .handler(async () => ({
    event: await getCurrentEvent(),
  }));
