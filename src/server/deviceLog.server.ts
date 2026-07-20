import {subMinutes} from 'date-fns';
import {tzOffset} from '@date-fns/tz';
import type {Prisma, DeviceType} from '../generated/prisma/client';
import type {LogMessage} from '../proto/logmessage';

/**
 * Convert a device's on-clock `deviceTime` (Unix seconds) into a UTC `Date`.
 *
 * Devices that don't report UTC send Europe/Berlin wall-clock time, which we
 * shift back to UTC. Shared by every `/api/*` `LogMessage` ingest path
 * (KultCash, noise) so they interpret the device clock identically.
 */
export function deviceTimeToDate(
  deviceTime: number,
  deviceTimeIsUtc: boolean,
): Date {
  const date = new Date(deviceTime * 1000);
  if (deviceTimeIsUtc) {
    return date;
  }
  return subMinutes(date, tzOffset('Europe/Berlin', date));
}

/**
 * Build the `DeviceLog` create input for a `LogMessage` envelope — the
 * per-upload device telemetry (`clientId`-keyed battery/USB voltage +
 * `deviceTime`) that rides along with any log upload, independent of its
 * payload (card transaction, noise recording, …).
 *
 * Shared by the KultCash and noise ingest paths. Callers must ensure
 * `message.clientId` is set (it's the primary key) and handle `P2002` so
 * re-uploads stay idempotent. `type` is only applied when the device row
 * doesn't exist yet.
 */
export function deviceLogCreateInput(
  message: LogMessage,
  deviceId: string,
  deviceTime: Date,
  type: DeviceType,
): Prisma.DeviceLogCreateInput {
  return {
    clientId: message.clientId,
    batteryVoltage: message.batteryVoltage,
    usbVoltage: message.usbVoltage,
    deviceTime,
    device: {
      connectOrCreate: {
        where: {id: deviceId},
        create: {id: deviceId, lastSeen: new Date(), type},
      },
    },
  };
}
