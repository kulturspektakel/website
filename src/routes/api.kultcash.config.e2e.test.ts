import {describe, test, expect} from 'vitest';
import {baseUrl, deviceHeaders, query} from '../../test/e2e/client';

describe('GET /api/kultcash/config', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/kultcash/config`);
    expect(res.status).toBe(401);
  });

  test('returns 204 for a device without a product list and registers it', async () => {
    const res = await fetch(`${baseUrl}/api/kultcash/config`, {
      headers: deviceHeaders('KASSE-CONFIG'),
    });
    expect(res.status).toBe(204);

    // the deviceAuth middleware should have registered the terminal
    const rows = await query<{type: string}>(
      `select type from "Device" where id = $1`,
      ['KASSE-CONFIG'],
    );
    expect(rows[0]?.type).toBe('CONTACTLESS_TERMINAL');
  });
});
