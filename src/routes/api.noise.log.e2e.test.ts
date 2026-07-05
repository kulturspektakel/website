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

  test('rejects a non-60s record interval with 400', async () => {
    // Only 60s disk aggregates belong on this path; a live 1 Hz record (or any
    // other interval) is malformed here and must be rejected so the device
    // discards the file.
    const body = LogMessage.encode(
      LogMessage.create({
        deviceId: 'NM-1',
        deviceTime: 1_735_689_600,
        deviceTimeIsUtc: true,
        noiseRecording: {
          seqNo: 1,
          bands: new Uint8Array(31),
          laeq: 60, lceq: 62, lafmax: 70, lcfmax: 68, lcpeak: 80,
          recordIntervalSeconds: 1,
        },
      }),
    ).finish();
    const res = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers, body});
    expect(res.status).toBe(400);
  });

  test('writes one aggregate row per upload and dedupes re-uploads', async () => {
    const body = () =>
      LogMessage.encode(
        LogMessage.create({
          deviceId: 'NM-1',
          deviceTime: 1_735_689_600, // 2025-01-01T00:00:00Z — start of the 60s window
          deviceTimeIsUtc: true,
          noiseRecording: {
            seqNo: 1,
            bands: new Uint8Array(31),
            laeq: 60,
            lceq: 62,
            lafmax: 70,
            lcfmax: 68,
            lcpeak: 80,
            recordIntervalSeconds: 60,
          },
        }),
      ).finish();

    const first = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers, body: body()});
    expect(first.status).toBe(201);

    // re-uploading the same file is deduplicated by @@unique([deviceId, measuredAt])
    const second = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers, body: body()});
    expect(second.status).toBe(201);

    const rows = await query<{
      ts: number;
      laeq: number;
      lceq: number;
      lafmax: number;
      lcfmax: number;
      lcpeak: number;
      laeq5m: number | null;
      lceq5m: number | null;
      laeq30m: number | null;
      lceq30m: number | null;
      bands_len: number;
    }>(
      `select extract(epoch from "measuredAt")::int as ts,
              "laeq", "lceq", "lafmax", "lcfmax", "lcpeak",
              "laeq5m", "lceq5m", "laeq30m", "lceq30m",
              octet_length("bands") as bands_len
       from "NoiseLog" where "deviceId" = $1 order by "measuredAt"`,
      ['NM-1'],
    );
    // One row, anchored at deviceTime (the window start); every flat field is
    // persisted to its renamed column. The device sent no trailing-window
    // values (buffer not yet full), so those columns are null.
    expect(rows).toEqual([
      {
        ts: 1_735_689_600,
        laeq: 60, lceq: 62, lafmax: 70, lcfmax: 68, lcpeak: 80,
        laeq5m: null, lceq5m: null, laeq30m: null, lceq30m: null,
        bands_len: 31,
      },
    ]);
  });

  test('persists the device-computed trailing 5m/30m Leq windows', async () => {
    // Once the device's rolling buffer has filled it includes laeq_5m/30m (and
    // the C-weighted pair); the history view reads these straight from the DB
    // rather than recomputing them, so they must round-trip on ingest.
    const nmHeaders = deviceHeaders('NM-WIN', 'NoiseMonitor/test');
    const body = LogMessage.encode(
      LogMessage.create({
        deviceId: 'NM-WIN',
        deviceTime: 1_735_689_600,
        deviceTimeIsUtc: true,
        noiseRecording: {
          seqNo: 1,
          bands: new Uint8Array(31),
          laeq: 60, lceq: 62, lafmax: 70, lcfmax: 68, lcpeak: 80,
          recordIntervalSeconds: 60,
          laeq5m: 58, lceq5m: 61, laeq30m: 56, lceq30m: 59,
        },
      }),
    ).finish();
    const res = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers: nmHeaders, body});
    expect(res.status).toBe(201);

    const rows = await query<{
      laeq5m: number;
      lceq5m: number;
      laeq30m: number;
      lceq30m: number;
    }>(
      `select "laeq5m", "lceq5m", "laeq30m", "lceq30m"
       from "NoiseLog" where "deviceId" = $1`,
      ['NM-WIN'],
    );
    expect(rows).toEqual([{laeq5m: 58, lceq5m: 61, laeq30m: 56, lceq30m: 59}]);
  });

  test('interprets a non-UTC deviceTime as Europe/Berlin local time', async () => {
    // A separate device so this row can't collide with the UTC write test.
    const tzHeaders = deviceHeaders('NM-TZ', 'NoiseMonitor/test');
    // deviceTime is the local wall clock as unix seconds: 2025-01-01T12:00:00 in
    // Berlin (CET, UTC+1). The handler subtracts the +1h offset to store the
    // correct UTC instant (11:00:00Z).
    const body = LogMessage.encode(
      LogMessage.create({
        deviceId: 'NM-TZ',
        deviceTime: 1_735_732_800, // 2025-01-01T12:00:00 read as UTC
        deviceTimeIsUtc: false,
        noiseRecording: {
          seqNo: 1,
          bands: new Uint8Array(31),
          laeq: 55, lceq: 57, lafmax: 65, lcfmax: 63, lcpeak: 75,
          recordIntervalSeconds: 60,
        },
      }),
    ).finish();
    const res = await fetch(`${baseUrl}/api/noise/log`, {method: 'POST', headers: tzHeaders, body});
    expect(res.status).toBe(201);

    const rows = await query<{ts: number}>(
      `select extract(epoch from "measuredAt")::int as ts
       from "NoiseLog" where "deviceId" = $1`,
      ['NM-TZ'],
    );
    expect(rows).toEqual([{ts: 1_735_729_200}]); // 11:00:00Z = 12:00 CET − 1h
  });
});
