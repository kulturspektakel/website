import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {prismaClient} from './prismaClient.server';

// Persist (or clear) the "Bühne" stage-assignment for a band application. The
// selection is a single grid cell — row (time slot, 0–2) and column (stage /
// "between", 0–4) — stored as two nullable columns. `null` on either clears both
// (mirrors rateBandApplication's "rating 0 = clear" branch). crewAuth gates the
// call; the assignment itself isn't viewer-attributed.
export const setBandApplicationStage = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({
      applicationId: z.string(),
      row: z.number().int().min(0).max(2).nullable(),
      col: z.number().int().min(0).max(4).nullable(),
    }),
  )
  .handler(async ({data, context}) => {
    if (!context.viewer?.id) {
      throw new Error('Unauthorized');
    }
    const clear = data.row == null || data.col == null;
    await prismaClient.bandApplication.update({
      where: {id: data.applicationId},
      data: clear
        ? {stageRow: null, stageColumn: null}
        : {stageRow: data.row, stageColumn: data.col},
    });
  });
