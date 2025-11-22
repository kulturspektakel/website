import z from 'zod';
import {schema} from '../routes/mitgliedsantrag';
import {prismaClient} from './prismaClient';

export async function scheduleTask(
  task: 'createMembershipApplication',
  data: z.infer<typeof schema>,
): Promise<void>;
export async function scheduleTask(
  task: string,
  data: Record<string, unknown>,
): Promise<void> {
  await prismaClient.$executeRaw`SELECT graphile_worker.add_job(
    ${task},
    payload := ${JSON.stringify(data)}::json
  );`;
}
