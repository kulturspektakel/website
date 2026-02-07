import {createServerFn} from '@tanstack/react-start';
import {scheduleTask} from '../../utils/scheduleTask.server';

export const createMembership = createServerFn()
  .inputValidator((data: any) => data)
  .handler(async ({data}) => {
    await scheduleTask('createMembershipApplication', data);
  });
