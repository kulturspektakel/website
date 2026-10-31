import {randomBytes} from 'crypto';
import {addDays, addYears, isAfter} from 'date-fns';
import {and, asc, eq, gt, ne} from 'drizzle-orm';
import {db} from './db.server';
import {crewCard, event} from './db/schema';
import {
  grantBonbudePrivilege,
  isBonbudeMember,
} from './crewCardPrivileges.server';
import {CrewCardType, EventType} from '../utils/enums';
import {dateToKultEpoch, kultEpochToDate} from '../utils/cardUtils';

type CrewCardHolder = {viewerId: string} | {nickname: string};

/**
 * The one way a CrewCard gets a holder: the holder's other valid cards are
 * suspended (one card per person, physical or wallet), the card is assigned,
 * and the Bonbude privilege is applied if the holder is in #bonbude.
 *
 * Pass `create` for a card that doesn't exist yet (e.g. an Apple Wallet card);
 * physical cards already exist from their device enrollment.
 */
export async function assignCrewCardToHolder({
  cardId,
  holder,
  create,
}: {
  cardId: Buffer;
  holder: CrewCardHolder;
  create?: {cardType: CrewCardType; validUntil: Date};
}) {
  const viewerId = 'viewerId' in holder ? holder.viewerId : null;
  const nickname = 'nickname' in holder ? holder.nickname : null;

  const {card, suspendedCards} = await db.transaction(async (tx) => {
    if (create) {
      await tx
        .insert(crewCard)
        .values({id: cardId, ...create, enrolledAt: new Date()});
    }

    const suspended = await tx
      .update(crewCard)
      .set({suspended: true})
      .where(
        and(
          viewerId
            ? eq(crewCard.viewerId, viewerId)
            : eq(crewCard.nickname, nickname!),
          eq(crewCard.suspended, false),
          gt(crewCard.validUntil, new Date()),
          ne(crewCard.id, cardId),
        ),
      )
      .returning({id: crewCard.id, cardType: crewCard.cardType});

    const [card] = await tx
      .update(crewCard)
      .set({viewerId, nickname})
      .where(eq(crewCard.id, cardId))
      .returning();
    if (!card) {
      throw new Error('Crew card not found');
    }
    return {card, suspendedCards: suspended};
  });

  // Enrollment resets `privileged` to false (and a new card starts without it)
  // and no membership event fires when a card changes hands, so an
  // already-in-#bonbude holder needs the privilege applied here. Nickname-only cards have no Slack account to look up.
  if (viewerId && (await isBonbudeMember(viewerId))) {
    await grantBonbudePrivilege(viewerId);
  }

  return {crewCard: card, suspendedCards};
}

/**
 * Wallet card ids start with this byte ("A1" for Apple), so they're
 * recognisable at a glance (`A1:…`) on a terminal or in #crewcards. No
 * physical card in use starts with it (they start with 0x53).
 */
export const WALLET_CARD_ID_PREFIX = 0xa1;

/** A 7-byte id (a physical card's NFC UID length): the prefix + 6 random. */
export function newWalletCardId(): Buffer {
  return Buffer.concat([Buffer.from([WALLET_CARD_ID_PREFIX]), randomBytes(6)]);
}

/**
 * The expiry of a CrewCard issued now that isn't tied to a device enrollment:
 * one day after the end of the next Kulturspektakel, snapped to the kult epoch
 * day boundary the card link stores. Refuses expiries more than a year ahead.
 */
export function walletCardValidity(
  nextEvent: {name: string; end: Date} | undefined,
  now: Date,
):
  | {ok: true; validUntilEpoch: number; validUntil: Date}
  | {ok: false; error: string} {
  if (!nextEvent) {
    return {
      ok: false,
      error: 'Es ist kein kommendes Kulturspektakel angelegt.',
    };
  }
  const validUntilEpoch = dateToKultEpoch(addDays(nextEvent.end, 1));
  const validUntil = kultEpochToDate(validUntilEpoch);
  if (isAfter(validUntil, addYears(now, 1))) {
    return {
      ok: false,
      error: `${nextEvent.name} ist mehr als ein Jahr entfernt.`,
    };
  }
  return {ok: true, validUntilEpoch, validUntil};
}

export async function nextKulturspektakel(now: Date) {
  return db.query.event.findFirst({
    where: and(
      eq(event.eventType, EventType.Kulturspektakel),
      gt(event.end, now),
    ),
    orderBy: asc(event.start),
    columns: {name: true, end: true},
  });
}
