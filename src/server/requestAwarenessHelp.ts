import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {enqueueGcpTask} from './enqueueGcpTask.server';

/**
 * Help request submitted through the box on the public `/awareness` page.
 * Enqueues two independent tasks — a Slack notification and a Twilio call that
 * reads the request out to the on-call phone — so one failing (and retrying)
 * never blocks the other.
 */
export const requestAwarenessHelp = createServerFn()
  .inputValidator(
    z.object({
      name: z.string().trim().min(1),
      phone: z.string().trim().min(1),
      message: z.string().trim().optional(),
      // Google Maps link (or "lat,lng") from the browser's geolocation.
      location: z.string().trim().optional(),
    }),
  )
  .handler(async ({data}) => {
    await Promise.all([
      enqueueGcpTask('awareness-slack', data),
      enqueueGcpTask('awareness-call', {
        name: data.name,
        message: data.message,
      }),
    ]);
  });
