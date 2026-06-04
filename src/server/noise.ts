import {prismaClient} from './prismaClient.server';
import {LogMessage} from '../proto/logmessage';
import {ApiError} from './apiError.server';
import type {DeviceToken} from './apiAuth.server';
import {subMinutes} from 'date-fns';
import {tzOffset} from '@date-fns/tz';

/**
 * POST /api/noise/log — ingests a protobuf `LogMessage` from a noise monitor.
 * Uses the same device authentication as KultCash, but requires the
 * `noise_recording` field: every `Record` it carries becomes one `NoiseLog`
 * row (one measurement per second).
 *
 * A message can hold a single live record (MQTT/BLE) or up to ~300 records
 * uploaded as a 5-minute batch. The first record is assumed to be at the
 * reference time; every other record's `measuredAt` is offset forward by its
 * `seqNo` distance (in seconds) from that first record — gap-aware because it
 * keys off `seqNo` rather than array position. The reference is the device
 * clock (`deviceTime`, same handling as KultCash) so re-uploading a batch
 * produces identical `measuredAt`s and is deduplicated via the
 * `@@unique([deviceId, measuredAt])` constraint; it falls back to server
 * receipt time only when the device sends no clock.
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
  if (!recording || recording.records.length === 0) {
    throw new ApiError(
      400,
      'Bad Request',
      new Error('Missing noiseRecording'),
    );
  }

  let referenceTime: number;
  if (message.deviceTime) {
    let deviceTime = new Date(message.deviceTime * 1000);
    if (!message.deviceTimeIsUtc) {
      deviceTime = subMinutes(
        deviceTime,
        tzOffset('Europe/Berlin', deviceTime),
      );
    }
    referenceTime = deviceTime.getTime();
  } else {
    referenceTime = Date.now();
  }

  const firstSeqNo = recording.records[0].seqNo;

  await prismaClient.noiseLog.createMany({
    data: recording.records.map((r) => ({
      deviceId,
      measuredAt: new Date(referenceTime + (r.seqNo - firstSeqNo) * 1000),
      bands: Uint8Array.from(r.bands),
      laeq_1s: r.laeq1s,
      lceq_1s: r.lceq1s,
      lafmax_1s: r.lafmax1s,
      lcfmax_1s: r.lcfmax1s,
      lcpeak_1s: r.lcpeak1s,
    })),
    skipDuplicates: true,
  });

  return new Response('Created', {status: 201});
}
