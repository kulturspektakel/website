import {describe, test, expect} from 'vitest';
import {baseUrl, deviceHeaders, query} from '../../test/e2e/client';
import {LogMessage} from '../proto/logmessage';

const headers = deviceHeaders('NM-1', 'NoiseMonitor/test');

describe('POST /api/noise/log', () => {
  test('rejects a message without noise_recording with 400', async () => {
    const body = LogMessage.encode(LogMessage.create({deviceId: 'NM-1'})).finish();
    const res = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers, body});
    expect(res.status).toBe(400);
  });

  test('writes one row per record (gap-aware) and dedupes re-uploads', async () => {
    const body = () =>
      LogMessage.encode(
        LogMessage.create({
          deviceId: 'NM-1',
          deviceTime: 1_735_689_600, // 2025-01-01T00:00:00Z
          deviceTimeIsUtc: true,
          noiseRecording: {
            records: [
              {seqNo: 1, bands: new Uint8Array(31), laeq1s: 60, lceq1s: 62, lafmax1s: 70, lcfmax1s: 68, lcpeak1s: 80},
              {seqNo: 4, bands: new Uint8Array(31), laeq1s: 61, lceq1s: 63, lafmax1s: 71, lcfmax1s: 69, lcpeak1s: 81},
            ],
          },
        }),
      ).finish();

    const first = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers, body: body()});
    expect(first.status).toBe(201);

    // re-uploading the same batch is deduplicated by @@unique([deviceId, measuredAt])
    const second = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers, body: body()});
    expect(second.status).toBe(201);

    const rows = await query<{ts: number; laeq_1s: number}>(
      `select extract(epoch from "measuredAt")::int as ts, "laeq_1s"
       from "NoiseLog" where "deviceId" = $1 order by "measuredAt"`,
      ['NM-1'],
    );
    expect(rows).toEqual([
      {ts: 1_735_689_600, laeq_1s: 60}, // first record anchored at deviceTime
      {ts: 1_735_689_603, laeq_1s: 61}, // seqNo 1 -> 4 = +3s (gap-aware)
    ]);
  });
});
