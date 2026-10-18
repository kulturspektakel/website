import {sql} from 'drizzle-orm';
import {db, type DbTransaction} from './db.server';

// Runs a write in a transaction and returns that transaction's Postgres id, so
// the client can wait for the write to come back over the Realtime stream
// (`awaitTxId`). The id must be read in the same transaction as the write, or
// the wait never resolves.
export function withTxid(write: (tx: DbTransaction) => Promise<unknown>) {
  return db.transaction(async (tx) => {
    await write(tx);
    const {
      rows: [{txid}],
    } = await tx.execute<{txid: string}>(
      sql`SELECT pg_current_xact_id()::text AS txid`,
    );
    return {txid};
  });
}
