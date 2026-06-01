import {inject} from 'vitest';
import {createHash} from 'node:crypto';
import {Client} from 'pg';

/**
 * Shared helpers for the colocated route e2e tests. Connection details come
 * from test/e2e/globalSetup.ts via `inject`.
 */
const {baseUrl, dbUrl, salt} = inject('e2e');

export {baseUrl};

const sign = (deviceId: string) =>
  createHash('sha1').update(deviceId + salt).digest('hex');

/** Headers a given device would send (Basic auth + product user-agent). */
export function deviceHeaders(deviceId: string, userAgent = 'Contactless/test') {
  return {
    'User-Agent': userAgent,
    Authorization:
      'Basic ' + Buffer.from(`${deviceId}:${sign(deviceId)}`).toString('base64'),
  };
}

/** Run a read query against the test database (own short-lived connection). */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({connectionString: dbUrl});
  await client.connect();
  try {
    const {rows} = await client.query(sql, params);
    return rows as T[];
  } finally {
    await client.end();
  }
}
