import {createHash} from 'crypto';
import {byteArrayToString, kultEpochToDate} from './cardUtils';

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

  const buffer = new Uint8Array([
    ...cardID,
    ...counter,
    ...deposit,
    ...balance,
    ...new TextEncoder().encode(process.env.CONTACTLESS_SALT),
  ]);
  const hash = new Uint8Array(
    createHash('sha1').update(buffer).digest().subarray(0, 5),
  );

  if (!signature.equals(hash)) {
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
