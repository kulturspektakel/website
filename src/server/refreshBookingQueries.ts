import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {sealBookingQueries} from './realtime.server';

// Re-seals the booking page's live queries before they expire (sealed queries
// live 60 s). crewAuth gates it like every other crew RPC, so a signed-out tab
// stops receiving updates once its current seal runs out.
export const refreshBookingQueries = createServerFn()
  .middleware([crewAuth])
  .validator(z.object({eventId: z.string()}))
  .handler(({data}) => sealBookingQueries(data.eventId));
