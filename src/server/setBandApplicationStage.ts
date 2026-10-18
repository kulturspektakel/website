import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {crewAuth} from './crewAuth';
import {eq} from 'drizzle-orm';
import {bandApplication} from './db/schema';
import {withTxid} from './withTxid.server';

// Persist (or clear) the "Bühne" stage-assignment for a band application. The
// selection is a single grid cell — row (time slot, 0–2) and column (stage /
// "between", 0–4) — stored as two nullable columns. `null` on either clears both
// (mirrors rateBandApplication's "rating 0 = clear" branch). crewAuth gates the
// call; the assignment itself isn't viewer-attributed.
export const setBandApplicationStage = createServerFn()
  .middleware([crewAuth])
  .validator(
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
    return withTxid(async (tx) => {
      const updated = await tx
        .update(bandApplication)
        .set(
          clear
            ? {stageRow: null, stageColumn: null}
            : {stageRow: data.row, stageColumn: data.col},
        )
        .where(eq(bandApplication.id, data.applicationId))
        .returning({id: bandApplication.id});
      if (updated.length === 0) {
        throw new Error(`BandApplication ${data.applicationId} not found`);
      }
    });
  });
