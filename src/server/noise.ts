import {prismaClient} from './prismaClient.server';
import {LogMessage} from '../proto/logmessage';
import {ApiError} from './apiError.server';
import type {DeviceToken} from './apiAuth.server';
import {subMinutes} from 'date-fns';
import {tzOffset} from '@date-fns/tz';

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
  // guard and the minute-bucketed history query must change together.
  if (recording.recordIntervalSeconds !== 60) {
    throw new ApiError(
      400,
      'Bad Request',
      new Error(
        `Expected recordIntervalSeconds=60, got ${recording.recordIntervalSeconds}`,
      ),
    );
  }

  let measuredAt: number;
  if (message.deviceTime) {
    let deviceTime = new Date(message.deviceTime * 1000);
    if (!message.deviceTimeIsUtc) {
      deviceTime = subMinutes(deviceTime, tzOffset('Europe/Berlin', deviceTime));
    }
    measuredAt = deviceTime.getTime();
  } else {
    measuredAt = Date.now();
  }

  // `createMany` with `skipDuplicates` keeps re-uploads idempotent (they return
  // 201 with no new row rather than a unique-constraint error), so the device
  // can safely retry and then delete the file.
  await prismaClient.noiseLog.createMany({
    data: [
      {
        deviceId,
        measuredAt: new Date(measuredAt),
        bands: Uint8Array.from(recording.bands),
        laeq: recording.laeq,
        lceq: recording.lceq,
        lafmax: recording.lafmax,
        lcfmax: recording.lcfmax,
        lcpeak: recording.lcpeak,
      },
    ],
    skipDuplicates: true,
  });

  return new Response('Created', {status: 201});
}
