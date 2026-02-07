import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {scheduleTask} from '../../utils/scheduleTask.server';
import {schema as step3Schema} from '../../components/booking/Step3';
import z from 'zod';

// Server schema validates step3 + eventId and transforms spotifyArtist
const serverSchema = z
  .object({
    eventId: z.string(),
  })
  .and(step3Schema)
  .transform(({spotifyArtist, ...data}) => ({
    ...data,
    spotifyArtist: spotifyArtist ? spotifyArtist.id : null,
  }));

export type ServerSchemaInput = z.input<typeof serverSchema>;

export const createBandApplication = createServerFn()
  .inputValidator(serverSchema)
  .handler(async ({data}) => {
    const application = await prismaClient.bandApplication.create({
      data,
      select: {id: true},
    });
    await scheduleTask('createBandApplication', application);
  });
