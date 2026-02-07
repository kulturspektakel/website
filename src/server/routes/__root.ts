import {createServerFn} from '@tanstack/react-start';
import {getCurrentEvent} from '../../utils/getCurrentEvent.server';

export const beforeLoad = createServerFn().handler(async () => ({
  event: await getCurrentEvent(),
}));
