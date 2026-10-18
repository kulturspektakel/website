import {asc, eq, or} from 'drizzle-orm';
import {db, type DbTransaction} from './db.server';
import {
  cardTransaction as cardTransactionTable,
  crewCard,
  deviceConfigVersion,
  order as orderTable,
  orderItem,
  product,
  productList,
} from './db/schema';
import {
  LogMessage,
  LogMessage_CardTransaction_TransactionType,
  LogMessage_Order_PaymentMethod,
} from '../proto/logmessage';
import {DeviceConfig} from '../proto/config';
import {AllLists} from '../proto/configs';
import {CardTransactionType, OrderPayment} from '../utils/enums';
import {addDays, isBefore, differenceInDays} from 'date-fns';
import crc32 from 'crc-32';
import {ApiError} from './apiError.server';
import {deviceTimeToDate, insertDeviceLog} from './deviceLog.server';
import {enqueueGcpTask} from './enqueueGcpTask.server';
import UnreachableCaseError from '../utils/UnreachableCaseError';

const PROTOBUF_HEADERS = {'Content-Type': 'application/x-protobuf'};

function getDeviceConfig(list: {
  id: number;
  name: string;
  products: Array<{name: string; price: number}>;
}) {
  const deviceConfig: DeviceConfig = {
    listId: list.id,
    name: list.name,
    products: list.products,
    checksum: 0,
  };

  deviceConfig.checksum = crc32.buf(DeviceConfig.encode(deviceConfig).finish());
  return deviceConfig;
}

/**
 * GET /api/kultcash/lists — returns all active product lists plus the set of
 * privileged / suspended crew cards, as an encoded `AllLists` protobuf message.
 * Supports `If-None-Match` for caching via the config CRC32.
 */
export async function handleLists(request: Request): Promise<Response> {
  const [lists, flaggedCrewCards] = await Promise.all([
    db.query.productList.findMany({
      where: eq(productList.active, true),
      orderBy: asc(productList.name),
      columns: {id: true, name: true},
      with: {
        products: {
          columns: {name: true, price: true},
          orderBy: asc(product.order),
          limit: 30,
        },
      },
    }),
    db
      .select({
        id: crewCard.id,
        privileged: crewCard.privileged,
        suspended: crewCard.suspended,
      })
      .from(crewCard)
      .where(or(eq(crewCard.privileged, true), eq(crewCard.suspended, true))),
  ]);
  const suspendedCrewCards = flaggedCrewCards.filter(
    (c) => c.suspended === true,
  );
  // Privileged unless suspended. As before (SQL `suspended <> true`), a card
  // whose `suspended` is NULL doesn't count as privileged.
  const privilegedCrewCards = flaggedCrewCards.filter(
    (c) => c.privileged === true && c.suspended === false,
  );

  const allLists: AllLists = {
    productList: lists.map(getDeviceConfig),
    privilegeTokens: privilegedCrewCards.map(({id}) => new Uint8Array(id)),
    suspendedCrewCards: suspendedCrewCards.map(({id}) => new Uint8Array(id)),
    versionNumber: 0,
    timestamp: 0,
    checksum: 0,
  };
  allLists.checksum = crc32.buf(AllLists.encode(allLists).finish());

  // The checksum covers the lists, not the version, so an unchanged poll (the
  // common case) is answered without the version lookup.
  if (request.headers.get('if-none-match') === `"${allLists.checksum}"`) {
    return new Response(null, {status: 304});
  }

  const configVersion = await configVersionFor(allLists.checksum);
  allLists.versionNumber = configVersion.version;
  allLists.timestamp = Math.floor(configVersion.createdAt.getTime() / 1000);

  const message = AllLists.encode(allLists).finish();
  return new Response(message.buffer as ArrayBuffer, {
    headers: {
      ...PROTOBUF_HEADERS,
      ETag: `"${allLists.checksum}"`,
    },
  });
}

// The version row for a config checksum, created on first sight. Devices poll
// `/lists`, so this reads first: an upsert would write (a new row version, WAL,
// replication) on every poll even when nothing changed.
async function configVersionFor(crc32: number) {
  const find = () =>
    db.query.deviceConfigVersion.findFirst({
      where: eq(deviceConfigVersion.crc32, crc32),
    });
  const existing = await find();
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(deviceConfigVersion)
    .values({crc32})
    .onConflictDoNothing()
    .returning();
  // `undefined` when a concurrent poll inserted it first.
  return created ?? (await find())!;
}

/**
 * POST /api/kultcash/log — ingests a protobuf `LogMessage` from a device. The
 * message can carry a card transaction, an order, and/or a crew card
 * enrollment; all are persisted in one go (the log is keyed by `clientId` for
 * idempotency).
 */
export async function handleLog(request: Request): Promise<Response> {
  let message: LogMessage;
  try {
    const body = await request.arrayBuffer();
    message = LogMessage.decode(new Uint8Array(body));
  } catch (e) {
    throw new ApiError(400, 'Bad Request', e as Error);
  }

  if (!message.deviceId || !message.clientId) {
    throw new ApiError(400, 'Bad Request', new Error('Missing device/clientID'));
  }

  const {deviceId, order, cardTransaction, crewCardEnrollment} = message;

  const deviceTime = deviceTimeToDate(
    message.deviceTime,
    message.deviceTimeIsUtc,
  );

  // If the device references a product list that no longer exists on the server
  // (e.g. it was deleted), the order's items can't be attributed and the nested
  // write would fail with a foreign-key error — surfacing as a 500 the device
  // retries forever. Reject it as an invalid request instead, so the device
  // treats the file as bad and stops retrying. A missing/unset listId is fine:
  // the item rows just store a null product list (name/price are denormalized).
  if (
    order?.listId != null &&
    !(await db.query.productList.findFirst({
      where: eq(productList.id, order.listId),
      columns: {id: true},
    }))
  ) {
    throw new ApiError(
      400,
      'Bad Request',
      new Error(`Order references unknown productListId ${order.listId}`),
    );
  }

  // The log and everything it carries are written together. An order without
  // a card transaction is part of the same transaction too, so a failure can't
  // leave a log behind whose order is missing (a re-upload would then be
  // rejected as a duplicate).
  const createdOrder = await db.transaction(async (tx) => {
    const isNew = await insertDeviceLog(
      tx,
      message,
      deviceId,
      deviceTime,
      'CONTACTLESS_TERMINAL',
    );
    if (!isNew) {
      // client ID already exists; throwing rolls back the device insert too
      throw new ApiError(409, 'Conflict');
    }
    const created =
      order != null
        ? await insertOrder(tx, order, deviceId, deviceTime)
        : undefined;
    if (cardTransaction != null) {
      await tx.insert(cardTransactionTable).values({
        ...cardTransaction,
        clientId: message.clientId,
        transactionType: mapTransactionType(cardTransaction.transactionType),
        orderId: created?.id,
      });
    }
    return created;
  });

  // Orders paid within a card transaction don't award badges.
  if (!cardTransaction && createdOrder?.crewCardId) {
    await enqueueGcpTask('badge-awarded', {orderId: createdOrder.id});
  }

  if (crewCardEnrollment) {
    const validUntil = kultEpochToDate(crewCardEnrollment.validUntil);
    const reset = {
      validUntil,
      viewerId: null,
      nickname: null,
      suspended: false,
      privileged: false,
      enrolledAt: deviceTime,
    };
    await db
      .insert(crewCard)
      .values({id: Buffer.from(crewCardEnrollment.crewCardId), ...reset})
      .onConflictDoUpdate({target: crewCard.id, set: reset});

    await enqueueGcpTask('crew-card-enrolled', {
      crewCardId: Array.from(crewCardEnrollment.crewCardId),
      validUntil: validUntil.toISOString(),
    });
  }

  return new Response('Created', {status: 201});
}

// The order of a log message, with its items. The crew card it was paid with
// is registered first if the device hasn't uploaded its enrollment yet (and
// then not further enrolled: valid until now).
async function insertOrder(
  tx: DbTransaction,
  order: NonNullable<LogMessage['order']>,
  deviceId: string,
  deviceTime: Date,
) {
  const crewCardId = order.crewCardId ? Buffer.from(order.crewCardId) : null;
  if (crewCardId) {
    await tx
      .insert(crewCard)
      .values({id: crewCardId, validUntil: new Date(), enrolledAt: deviceTime})
      .onConflictDoNothing();
  }
  const [created] = await tx
    .insert(orderTable)
    .values({
      payment: mapPayment(order.paymentMethod),
      createdAt: deviceTime,
      crewCardId,
      deviceId,
    })
    .returning({id: orderTable.id, crewCardId: orderTable.crewCardId});
  const items = order.cartItems
    .filter(({product}) => product != undefined)
    .map(({amount, product}) => ({
      orderId: created.id,
      amount,
      name: product!.name,
      perUnitPrice: product!.price,
      productListId: order.listId,
    }));
  if (items.length) {
    await tx.insert(orderItem).values(items);
  }
  return created;
}

function mapTransactionType(
  payment: LogMessage_CardTransaction_TransactionType,
): CardTransactionType {
  switch (payment) {
    case LogMessage_CardTransaction_TransactionType.CASHOUT:
      return CardTransactionType.Cashout;
    case LogMessage_CardTransaction_TransactionType.CHARGE:
      return CardTransactionType.Charge;
    case LogMessage_CardTransaction_TransactionType.TOP_UP:
      return CardTransactionType.TopUp;
    case LogMessage_CardTransaction_TransactionType.REPAIR:
      return CardTransactionType.Repair;
    case LogMessage_CardTransaction_TransactionType.DONATION:
      return CardTransactionType.Donation;
    case LogMessage_CardTransaction_TransactionType.UNRECOGNIZED:
      throw new Error('Unrecognized TransactionType');
    default:
      throw new UnreachableCaseError(payment);
  }
}

function mapPayment(payment: LogMessage_Order_PaymentMethod): OrderPayment {
  switch (payment) {
    case LogMessage_Order_PaymentMethod.CASH:
      return OrderPayment.CASH;
    case LogMessage_Order_PaymentMethod.BON:
      return OrderPayment.BON;
    case LogMessage_Order_PaymentMethod.FREE_BAND:
      return OrderPayment.FREE_BAND;
    case LogMessage_Order_PaymentMethod.FREE_CREW:
      return OrderPayment.FREE_CREW;
    case LogMessage_Order_PaymentMethod.SUM_UP:
      return OrderPayment.SUM_UP;
    case LogMessage_Order_PaymentMethod.VOUCHER:
      return OrderPayment.VOUCHER;
    case LogMessage_Order_PaymentMethod.KULT_CARD:
      return OrderPayment.KULT_CARD;
    case LogMessage_Order_PaymentMethod.UNRECOGNIZED:
      throw new Error('Unrecognized PaymentMethod');
    default:
      throw new UnreachableCaseError(payment);
  }
}

// Epoch starts at 02.01.2025 04:00:00 UTC
// Using UTC-04:00 as time zone, so cards are valid until 06:00 (UTC+02:00, CEST) the next day
const START_OF_EPOCH = new Date(2025, 0, 2, 4);
export function kultEpochToDate(epoch: number): Date {
  return addDays(START_OF_EPOCH, epoch);
}

export function dateToKultEpoch(date: Date): number {
  if (isBefore(date, START_OF_EPOCH)) {
    return differenceInDays(date, START_OF_EPOCH);
  }
  return differenceInDays(date, START_OF_EPOCH) + 1;
}
