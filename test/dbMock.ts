import {vi} from 'vitest';
import {getTableName, type SQL} from 'drizzle-orm';
import {PgDialect, type PgTable} from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

/** The bound parameters of a Drizzle condition, e.g. `[id]` for `eq(t.id, id)`. */
export function whereParams(condition: SQL | undefined) {
  return condition ? dialect.sqlToQuery(condition).params : [];
}

/**
 * A stand-in for `db` from `src/server/db.server.ts` in unit tests:
 *
 * - `query.<table>.findFirst` / `findMany` are `vi.fn()`s to stub reads;
 * - `update`, `insert` and `delete` record `(tableName, values, whereParams)`
 *   (`delete`: `(tableName, whereParams)`) on the returned mocks. Their builders
 *   resolve to whatever the recording mock returns, so
 *   `inserts.mockResolvedValueOnce([row])` stubs a `.returning()`.
 *
 * Use it from a hoisted mock:
 *
 *   const {db, updates} = await vi.hoisted(async () =>
 *     (await import('../../../test/dbMock')).dbMock(),
 *   );
 *   vi.mock('../db.server', () => ({db}));
 */
export function dbMock() {
  const updates = vi.fn();
  const inserts = vi.fn();
  const deletes = vi.fn();

  // `await builder` and `await builder.returning()` both resolve to the result.
  const builder = (run: () => unknown) => ({
    returning: async () => run(),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(run()).then(resolve, reject),
  });

  const query = new Proxy(
    {} as Record<
      string,
      {findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>}
    >,
    {
      get: (tables, name: string) =>
        (tables[name] ??= {findFirst: vi.fn(), findMany: vi.fn()}),
    },
  );

  const db = {
    query,
    update: (table: PgTable) => ({
      set: (values: unknown) => ({
        where: (condition: SQL) =>
          builder(() =>
            updates(getTableName(table), values, whereParams(condition)),
          ),
      }),
    }),
    insert: (table: PgTable) => ({
      values: (values: unknown) =>
        builder(() => inserts(getTableName(table), values)),
    }),
    delete: (table: PgTable) => ({
      where: (condition: SQL) =>
        builder(() => deletes(getTableName(table), whereParams(condition))),
    }),
  };

  return {db, query, updates, inserts, deletes};
}
