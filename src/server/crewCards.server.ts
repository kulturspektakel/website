import {randomBytes} from 'crypto';
import {addDays, addYears, isAfter} from 'date-fns';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import {db, type DbExecutor, type DbTransaction} from './db.server';
import {
  crewCard,
  crewCardEnrollment,
  crewCardHolder,
  event,
  order,
} from './db/schema';
import {
  grantBonbudePrivilege,
  isBonbudeMember,
} from './crewCardPrivileges.server';
import {CrewCardSuspendedReason, CrewCardType, EventType} from '../utils/enums';
import {dateToKultEpoch, kultEpochToDate} from '../utils/cardUtils';

/**
 * CrewCards (docs/crew-card-holders-plan.md):
 *
 * - A `CrewCardHolder` is a person, a Slack user or a nickname. `privileged`
 *   (Bonbude) is theirs and applies to all their cards.
 * - A `CrewCard` is one issuance of a serial (a chip's NFC UID or a wallet
 *   card's `A1…` id) to a holder. Rows are never deleted. A holder has at most
 *   one live (unsuspended) card per type, a serial at most one live card.
 * - A `CrewCardEnrollment` is a physical chip enrolled on a device that nobody
 *   has been assigned yet. It works anonymously until `validUntil`.
 *
 * Orders carry only the serial. A card's order window runs from its
 * `enrolledAt` until the serial's next card or newer enrollment starts, so
 * suspending a card doesn't end it: orders paid with a card after it was
 * suspended still belong to it.
 */

type CrewCardHolderIdentity = {viewerId: string} | {nickname: string};

/** The random part of a holder page URL, `/crewcard/<pageToken>`. */
function newPageToken(): string {
  return randomBytes(18).toString('base64url');
}

/** The holder for a Slack user or nickname, created if there's none yet. */
async function findOrCreateHolder(
  tx: DbTransaction,
  identity: CrewCardHolderIdentity,
) {
  const where =
    'viewerId' in identity
      ? eq(crewCardHolder.viewerId, identity.viewerId)
      : eq(crewCardHolder.nickname, identity.nickname);
  const existing = await tx.query.crewCardHolder.findFirst({where});
  if (existing) {
    return existing;
  }
  const [created] = await tx
    .insert(crewCardHolder)
    .values({...identity, pageToken: newPageToken()})
    .onConflictDoNothing()
    .returning();
  return created ?? (await tx.query.crewCardHolder.findFirst({where}))!;
}

/**
 * Issuing a card, inside the caller's transaction: the holder's live card of
 * the same type is suspended (`replaced`), as is a live card someone else has
 * on the same serial (`reassigned`), the new card is inserted and the serial's
 * enrollment, if any, is used up. The other card type is left alone: a holder
 * can have a physical card and a wallet pass at once.
 */
async function issue(
  tx: DbTransaction,
  values: {
    holderId: string;
    serial: Buffer;
    cardType: CrewCardType;
    validUntil: Date;
    enrolledAt: Date;
    walletAuthToken?: string;
  },
) {
  const now = new Date();
  const replaced = await tx
    .update(crewCard)
    .set({suspendedAt: now, suspendedReason: CrewCardSuspendedReason.replaced})
    .where(
      and(
        eq(crewCard.holderId, values.holderId),
        eq(crewCard.cardType, values.cardType),
        isNull(crewCard.suspendedAt),
      ),
    )
    .returning({id: crewCard.id});
  await tx
    .update(crewCard)
    .set({
      suspendedAt: now,
      suspendedReason: CrewCardSuspendedReason.reassigned,
    })
    .where(
      and(eq(crewCard.serial, values.serial), isNull(crewCard.suspendedAt)),
    );
  const [card] = await tx
    .insert(crewCard)
    .values({...values, issuedAt: now})
    .returning({
      id: crewCard.id,
      serial: crewCard.serial,
      validUntil: crewCard.validUntil,
    });
  await tx
    .delete(crewCardEnrollment)
    .where(eq(crewCardEnrollment.serial, values.serial));
  return {card, replaced: replaced.length > 0};
}

/**
 * No membership event fires when a card is issued, so a holder already in
 * #bonbude (new, or one whose privilege was reset by hand) gets the privilege
 * here. Pass the membership lookup started alongside the issuing.
 */
async function applyBonbudeMembership(
  viewerId: string,
  membership: Promise<boolean>,
) {
  if (await membership) {
    await grantBonbudePrivilege(viewerId);
  }
}

/**
 * Assigns a physical chip (in #crewcards) to a Slack user or nickname. The chip
 * is an enrollment nobody has been assigned yet, or has a live card: then it's
 * a reassignment (fixing a wrong assignment, or handing a renewed card to
 * someone else), and the new card's window starts where the old one's last
 * enrollment did. Right after an issuance all orders move over; after a
 * renewal the previous holder keeps what came before. Assigning the chip to
 * its current holder changes nothing.
 */
export async function assignPhysicalCard(
  serial: Buffer,
  identity: CrewCardHolderIdentity,
) {
  // Nickname holders have no Slack account to look up.
  const membership =
    'viewerId' in identity
      ? isBonbudeMember(identity.viewerId)
      : Promise.resolve(false);
  const result = await db.transaction(async (tx) => {
    const [holder, enrollment, liveCard] = await Promise.all([
      findOrCreateHolder(tx, identity),
      tx.query.crewCardEnrollment.findFirst({
        where: eq(crewCardEnrollment.serial, serial),
        columns: {validUntil: true, enrolledAt: true},
      }),
      tx.query.crewCard.findFirst({
        where: and(eq(crewCard.serial, serial), isNull(crewCard.suspendedAt)),
        columns: {
          holderId: true,
          validUntil: true,
          enrolledAt: true,
          reenrolledAt: true,
        },
      }),
    ]);
    if (!enrollment && liveCard?.holderId === holder.id) {
      return {validUntil: liveCard.validUntil, replaced: false};
    }
    const source =
      enrollment ??
      (liveCard && {
        validUntil: liveCard.validUntil,
        enrolledAt: liveCard.reenrolledAt ?? liveCard.enrolledAt,
      });
    if (!source) {
      throw new Error('Crew card not found');
    }
    const {replaced} = await issue(tx, {
      holderId: holder.id,
      serial,
      cardType: CrewCardType.PHYSICAL,
      ...source,
    });
    return {validUntil: source.validUntil, replaced};
  });
  if ('viewerId' in identity) {
    await applyBonbudeMembership(identity.viewerId, membership);
  }
  return result;
}

/**
 * The Slack user's wallet card for `/crewcard`: their live, unexpired one if
 * they have it (handed out again, nothing changes), otherwise a new one, valid
 * until the day after the next Kulturspektakel, replacing an expired one.
 */
export async function walletCardFor(viewerId: string, now: Date) {
  const existing = await db.query.crewCardHolder.findFirst({
    where: eq(crewCardHolder.viewerId, viewerId),
    columns: {pageToken: true},
    with: {
      crewCards: {
        where: and(
          eq(crewCard.cardType, CrewCardType.APPLE_WALLET),
          isNull(crewCard.suspendedAt),
          gt(crewCard.validUntil, now),
        ),
        columns: {id: true, validUntil: true},
      },
    },
  });
  const live = existing?.crewCards[0];
  if (existing && live) {
    return {ok: true as const, pageToken: existing.pageToken, card: live};
  }

  const validity = walletCardValidity(await nextKulturspektakel(now), now);
  if (!validity.ok) {
    return validity;
  }
  const membership = isBonbudeMember(viewerId);
  const result = await db.transaction(async (tx) => {
    const holder = await findOrCreateHolder(tx, {viewerId});
    const {card, replaced} = await issue(tx, {
      holderId: holder.id,
      serial: newWalletCardId(),
      cardType: CrewCardType.APPLE_WALLET,
      validUntil: validity.validUntil,
      enrolledAt: now,
      walletAuthToken: newWalletAuthToken(),
    });
    return {pageToken: holder.pageToken, card, issued: {replaced}};
  });
  await applyBonbudeMembership(viewerId, membership);
  return {ok: true as const, ...result};
}

/**
 * A device enrolled a physical chip. A chip with a live card is renewed: same
 * card, same holder, the new `validUntil`; `enrolledAt` stays, so the orders
 * before stay in the card's window. Any other chip becomes (or replaces) an
 * anonymous enrollment that waits for a holder.
 */
export async function recordEnrollment({
  serial,
  validUntil,
  enrolledAt,
  deviceId,
}: {
  serial: Buffer;
  validUntil: Date;
  enrolledAt: Date;
  deviceId: string;
}): Promise<{renewed: {holderId: string} | undefined}> {
  return db.transaction(async (tx) => {
    const [renewed] = await tx
      .update(crewCard)
      .set({validUntil, reenrolledAt: enrolledAt})
      .where(
        and(
          eq(crewCard.serial, serial),
          eq(crewCard.cardType, CrewCardType.PHYSICAL),
          isNull(crewCard.suspendedAt),
        ),
      )
      .returning({holderId: crewCard.holderId});
    if (!renewed) {
      const values = {validUntil, enrolledAt, deviceId};
      await tx
        .insert(crewCardEnrollment)
        .values({serial, ...values})
        .onConflictDoUpdate({target: crewCardEnrollment.serial, set: values});
    }
    return {renewed};
  });
}

/**
 * The card a card link (signed payload) is for: the serial's card with the
 * payload's `validUntil`, so an old link of a reused chip never leads to the
 * chip's next holder. The newest one if a reassignment copied it.
 */
export async function cardForPayload(serial: Buffer, validUntil: Date) {
  return db.query.crewCard.findFirst({
    where: and(
      eq(crewCard.serial, serial),
      eq(crewCard.validUntil, validUntil),
    ),
    orderBy: desc(crewCard.issuedAt),
    columns: {id: true, suspendedAt: true},
    with: {holder: {columns: {pageToken: true}}},
  });
}

/**
 * Cards with their order window: `[windowStart, windowEnd)`, where the end is
 * the start of the serial's next card or of a newer enrollment (null: open).
 * The window runs per serial, so the cards can be narrowed to the serials a
 * holder ever had; filter on the holder outside the subquery.
 */
function cardWindows(executor: DbExecutor, holderId?: string) {
  const nextCard = sql<Date | null>`lead(${crewCard.enrolledAt}) over (partition by ${crewCard.serial} order by ${crewCard.enrolledAt}, ${crewCard.issuedAt})`;
  return executor
    .select({
      holderId: sql<string>`${crewCard.holderId}`.as('holderId'),
      serial: sql<Buffer>`${crewCard.serial}`.as('serial'),
      windowStart: sql<Date>`${crewCard.enrolledAt}`.as('windowStart'),
      windowEnd:
        sql<Date | null>`least(${nextCard}, ${crewCardEnrollment.enrolledAt})`.as(
          'windowEnd',
        ),
    })
    .from(crewCard)
    .leftJoin(
      crewCardEnrollment,
      and(
        eq(crewCardEnrollment.serial, crewCard.serial),
        gt(crewCardEnrollment.enrolledAt, crewCard.enrolledAt),
      ),
    )
    .where(
      holderId
        ? inArray(
            crewCard.serial,
            executor
              .select({serial: crewCard.serial})
              .from(crewCard)
              .where(eq(crewCard.holderId, holderId)),
          )
        : undefined,
    )
    .as('cardWindow');
}

/**
 * The ids of the orders paid with the holder's cards (all of them, old and
 * suspended ones too), as a subquery for `inArray(order.id, …)`.
 */
export function holderOrderIds(holderId: string, executor: DbExecutor = db) {
  const w = cardWindows(executor, holderId);
  return executor
    .select({id: order.id})
    .from(order)
    .innerJoin(
      w,
      and(
        eq(order.crewCardSerial, w.serial),
        gte(order.createdAt, w.windowStart),
        or(isNull(w.windowEnd), lt(order.createdAt, w.windowEnd)),
      ),
    )
    .where(eq(w.holderId, holderId));
}

/**
 * The ids of the orders paid with an enrolled chip nobody has been assigned
 * yet (since its enrollment), as a subquery for `inArray(order.id, …)`.
 */
export function enrollmentOrderIds(serial: Buffer, executor: DbExecutor = db) {
  return executor
    .select({id: order.id})
    .from(order)
    .innerJoin(
      crewCardEnrollment,
      and(
        eq(crewCardEnrollment.serial, order.crewCardSerial),
        gte(order.createdAt, crewCardEnrollment.enrolledAt),
      ),
    )
    .where(eq(crewCardEnrollment.serial, serial));
}

/** The holder of the card whose window an order paid with `serial` is in. */
export async function holderForOrder(
  serial: Buffer,
  createdAt: Date,
  executor: DbExecutor = db,
): Promise<string | undefined> {
  const w = cardWindows(executor);
  const [card] = await executor
    .select({holderId: w.holderId})
    .from(w)
    .where(
      and(
        // The window's partition key, so Postgres narrows the cards first.
        eq(w.serial, serial),
        sql`${w.windowStart} <= ${createdAt}`,
        or(isNull(w.windowEnd), sql`${w.windowEnd} > ${createdAt}`),
      ),
    );
  return card?.holderId;
}

/**
 * The CrewCard lists for the devices (`/api/kultcash/lists`), as serials, in
 * one query (the endpoint is polled):
 *
 * - suspended: serials whose newest card is suspended as `lost` or `replaced`
 *   (a `reassigned` card has a live successor) and that weren't enrolled again
 *   since (a re-enrolled chip waits for its next holder and must work).
 * - privileged: serials of live cards whose holder is privileged.
 */
export async function deviceCardLists() {
  const newest = db
    .selectDistinctOn([crewCard.serial], {
      serial: crewCard.serial,
      suspendedAt: crewCard.suspendedAt,
      suspendedReason: crewCard.suspendedReason,
    })
    .from(crewCard)
    .orderBy(crewCard.serial, desc(crewCard.issuedAt))
    .as('newest');

  const suspended = db
    .select({
      privileged: sql<boolean>`false`.as('privileged'),
      serial: newest.serial,
    })
    .from(newest)
    .leftJoin(
      crewCardEnrollment,
      and(
        eq(crewCardEnrollment.serial, newest.serial),
        gt(crewCardEnrollment.enrolledAt, newest.suspendedAt),
      ),
    )
    .where(
      and(
        inArray(newest.suspendedReason, [
          CrewCardSuspendedReason.lost,
          CrewCardSuspendedReason.replaced,
        ]),
        isNull(crewCardEnrollment.serial),
      ),
    );
  const privileged = db
    .select({
      privileged: sql<boolean>`true`.as('privileged'),
      serial: crewCard.serial,
    })
    .from(crewCard)
    .innerJoin(crewCardHolder, eq(crewCardHolder.id, crewCard.holderId))
    .where(
      and(isNull(crewCard.suspendedAt), eq(crewCardHolder.privileged, true)),
    );
  const rows = await suspended.unionAll(privileged).orderBy(sql`"serial"`);

  return {
    suspended: rows.filter((r) => !r.privileged).map((r) => r.serial),
    privileged: rows.filter((r) => r.privileged).map((r) => r.serial),
  };
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
 * A wallet card's pass `authenticationToken`, which Wallet sends with every
 * web service request for the pass (Apple wants at least 16 characters).
 */
export function newWalletAuthToken(): string {
  return randomBytes(24).toString('base64url');
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

export async function nextKulturspektakel(
  now: Date,
  executor: DbExecutor = db,
) {
  return executor.query.event.findFirst({
    where: and(
      eq(event.eventType, EventType.Kulturspektakel),
      gt(event.end, now),
    ),
    orderBy: asc(event.start),
    columns: {id: true, name: true, start: true, end: true},
  });
}
