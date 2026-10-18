import {subMinutes} from 'date-fns';
import {tzOffset} from '@date-fns/tz';
import type {Prisma} from '../generated/prisma/client';
import type {DbTransaction} from './db.server';
import {device, deviceLog} from './db/schema';
import type {DeviceType} from '../utils/enums';
import type {LogMessage} from '../proto/logmessage';
import {timeZone} from '../utils/dateUtils';

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
  return subMinutes(date, tzOffset(timeZone, date));
}

/**
 * Insert the `DeviceLog` for a `LogMessage` envelope — the per-upload device
 * telemetry (`clientId`-keyed battery/USB voltage + `deviceTime`) that rides
 * along with any log upload — registering the device on first contact (`type`
 * only applies then). Runs inside the caller's transaction, so the log and its
 * payload are written together.
 *
 * Callers must ensure `message.clientId` is set (it's the primary key).
 * Returns false when this log was uploaded before (a re-upload of the same
 * `clientId`); the caller decides what that means.
 */
export async function insertDeviceLog(
  tx: DbTransaction,
  message: LogMessage,
  deviceId: string,
  deviceTime: Date,
  type: DeviceType,
) {
  await tx
    .insert(device)
    .values({id: deviceId, lastSeen: new Date(), type})
    .onConflictDoNothing();
  const inserted = await tx
    .insert(deviceLog)
    .values({
      clientId: message.clientId,
      batteryVoltage: message.batteryVoltage,
      usbVoltage: message.usbVoltage,
      deviceTime,
      deviceId,
    })
    .onConflictDoNothing({target: deviceLog.clientId})
    .returning({clientId: deviceLog.clientId});
  return inserted.length > 0;
}

/**
 * Prisma version of `insertDeviceLog` for the noise ingest (`P2002` there means
 * re-upload). Delete it when noise moves to Drizzle.
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
