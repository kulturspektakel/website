import {createServerFn} from '@tanstack/react-start';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';

export const createMembership = createServerFn()
  .inputValidator((data: any) => data)
  .handler(async ({data}) => {
    await enqueueGcpTask('create-membership-application', data);
  });
