import {prismaClient} from './prismaClient.server';
import {LogMessage} from '../proto/logmessage';
import {ApiError} from './apiError.server';
import type {DeviceToken} from './apiAuth.server';
import {deviceLogCreateInput, deviceTimeToDate} from './deviceLog.server';
import {Prisma} from '../generated/prisma/client';

/**
 * POST /api/noise/log — ingests a protobuf `LogMessage` from a noise monitor.
 * Uses the same device authentication as KultCash, but requires the
 * `noise_recording` field. Each upload is one file holding a single
 * `NoiseRecording`: a 60-second energy aggregate (`recordIntervalSeconds` = 60)
 * that becomes one `NoiseLog` row.
 *
 * `deviceTime` marks the START of the aggregate's 60-second window and is
 * captured on-device at the first second of that window, so it's accurate
 * regardless of upload delay; it becomes the row's `measuredAt` (same
 * device-clock handling as KultCash). Re-uploading a file therefore produces an
 * identical `measuredAt` and is deduplicated via the
 * `@@unique([deviceId, measuredAt])` constraint. It falls back to server
 * receipt time only when the device sends no clock.
 *
 * Live 1 Hz records (`recordIntervalSeconds` = 1) arrive over MQTT/BLE and are
 * consumed in the browser; they are never uploaded here.
 */
export async function handleNoiseLog(
  request: Request,
  device: DeviceToken,
): Promise<Response> {
  // The `deviceAuth` middleware registers/touches the device, so logs are
  // always keyed to the authenticated device.
  const {deviceId} = device;

  let message: LogMessage;
  try {
    message = LogMessage.decode(new Uint8Array(await request.arrayBuffer()));
  } catch (e) {
    throw new ApiError(400, 'Bad Request', e as Error);
  }

  const recording = message.noiseRecording;
  if (!recording) {
    throw new ApiError(400, 'Bad Request', new Error('Missing noiseRecording'));
  }

  // Only 60-second disk aggregates belong on the HTTP path — live 1 Hz records
  // travel over MQTT/BLE and are never uploaded. Reject anything else with 400
  // so the device discards the (malformed / wrong-transport) file rather than
  // retrying it forever. If the on-disk aggregation interval ever changes, this
  // guard and the history query (which treats each row as one 60s aggregate)
  // must change together.
  if (recording.recordIntervalSeconds !== 60) {
    throw new ApiError(
      400,
      'Bad Request',
      new Error(
        `Expected recordIntervalSeconds=60, got ${recording.recordIntervalSeconds}`,
      ),
    );
  }

  const measuredAt = message.deviceTime
    ? deviceTimeToDate(message.deviceTime, message.deviceTimeIsUtc)
    : new Date();

  // The upload carries the same device-telemetry envelope as KultCash. When the
  // device sends a `clientId` (the log's primary key), record a `DeviceLog` for
  // this check-in too — battery/USB voltage keyed to the device — reusing the
  // shared builder. Re-uploads collide on `clientId`; swallow the `P2002` so
  // they stay idempotent (matching the noise-log `skipDuplicates` below).
  if (message.clientId) {
    await prismaClient.deviceLog
      .create({
        data: deviceLogCreateInput(
          message,
          deviceId,
          measuredAt,
          'NOISE_MONITOR',
        ),
      })
      .catch((e) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          return;
        }
        throw e;
      });
  }

  // `createMany` with `skipDuplicates` keeps re-uploads idempotent (they return
  // 201 with no new row rather than a unique-constraint error), so the device
  // can safely retry and then delete the file.
  await prismaClient.noiseLog.createMany({
    data: [
      {
        deviceId,
        measuredAt,
        bands: Uint8Array.from(recording.bands),
        laeq: recording.laeq,
        lceq: recording.lceq,
        lafmax: recording.lafmax,
        lcfmax: recording.lcfmax,
        lcpeak: recording.lcpeak,
        // Absent until the device's rolling window has filled → stored as null.
        laeq5m: recording.laeq5m ?? null,
        lceq5m: recording.lceq5m ?? null,
        laeq30m: recording.laeq30m ?? null,
        lceq30m: recording.lceq30m ?? null,
      },
    ],
    skipDuplicates: true,
  });

  return new Response('Created', {status: 201});
}
