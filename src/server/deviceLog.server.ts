import {subMinutes} from 'date-fns';
import {tzOffset} from '@date-fns/tz';
import type {DbExecutor} from './db.server';
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
 * only applies then). Pass the caller's transaction to write the log together
 * with its payload.
 *
 * Callers must ensure `message.clientId` is set (it's the primary key).
 * Returns false when this log was uploaded before (a re-upload of the same
 * `clientId`); the caller decides what that means.
 */
export async function insertDeviceLog(
  tx: DbExecutor,
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
