import {createHash} from 'crypto';
import {byteArrayToString, kultEpochToDate} from './cardUtils';

// The card payload: id (7 B) | counter or validUntil (2 B, LE) | deposit (1 B)
// | balance (2 B, LE) | signature (5 B), base64url-encoded. Mirrors the
// contactless firmware (`main/rfid.c`). CrewCards leave deposit and balance 0.
function sign(data: Uint8Array): Buffer {
  return createHash('sha1')
    .update(data)
    .update(new TextEncoder().encode(process.env.CONTACTLESS_SALT))
    .digest()
    .subarray(0, 5);
}

export function encodeCrewCardPayload(
  cardId: Uint8Array,
  validUntilEpoch: number,
): string {
  const data = Buffer.alloc(12);
  data.set(cardId, 0);
  data.writeUInt16LE(validUntilEpoch, 7);
  return Buffer.concat([data, sign(data)]).toString('base64url');
}

export function decodePayload(
  type: 'kultcard',
  payload: string,
): {
  type: 'kultcard';
  cardId: string;
  deposit: number;
  balance: number;
  counter: number;
};
export function decodePayload(
  type: 'crewcard',
  payload: string,
): {
  type: 'crewcard';
  cardId: string;
  validUntil: Date;
};
export function decodePayload(type: 'crewcard' | 'kultcard', payload: string) {
  if (payload.length !== 23) {
    throw new Error('Wrong payload length');
  }

  const payloadBuffer = Buffer.from(payload, 'base64url');

  const counter = payloadBuffer.subarray(7, 9);
  const deposit = payloadBuffer.subarray(9, 10);
  const balance = payloadBuffer.subarray(10, 12);
  const cardID = payloadBuffer.subarray(0, 7);
  const signature = payloadBuffer.subarray(12);

  if (!signature.equals(sign(payloadBuffer.subarray(0, 12)))) {
    throw new Error('Invalid signature');
  }
  const cardId = byteArrayToString(cardID);
  if (type === 'kultcard') {
    return {
      type,
      cardId,
      balance: balance.readUInt16LE(),
      deposit: deposit.readUInt8(),
      counter: counter.readUInt16LE(),
    };
  } else if (type === 'crewcard') {
    return {
      type,
      cardId,
      validUntil: kultEpochToDate(counter.readUInt16LE()),
    };
  }
  throw new Error('Invalid card type');
}
