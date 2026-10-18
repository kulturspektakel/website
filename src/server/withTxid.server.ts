import type {Prisma} from '../generated/prisma/client';
import {prismaClient} from './prismaClient.server';

// Runs a write in a transaction and returns that transaction's Postgres id, so
// the client can wait for the write to come back over the Realtime stream
// (`awaitTxId`). The id must be read in the same transaction as the write, or
// the wait never resolves.
export function withTxid(
  write: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
  return prismaClient.$transaction(async (tx) => {
    await write(tx);
    const [{txid}] = await tx.$queryRaw<{txid: string}[]>`
      SELECT pg_current_xact_id()::text AS txid`;
    return {txid};
  });
}
