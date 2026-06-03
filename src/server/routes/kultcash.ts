import {prismaClient} from '../../utils/prismaClient.server';
import {
  LogMessage,
  LogMessage_CardTransaction_TransactionType,
  LogMessage_Order_PaymentMethod,
} from '../../proto/logmessage';
import {DeviceConfig} from '../../proto/config';
import {AllLists} from '../../proto/configs';
import {
  ProductList,
  Prisma,
  OrderPayment,
  CardTransactionType,
} from '../../generated/prisma/client';
import {subMinutes, addDays, isBefore, differenceInDays} from 'date-fns';
import {tzOffset} from '@date-fns/tz';
import crc32 from 'crc-32';
import {ApiError} from '../../utils/apiError.server';
import type {DeviceToken} from '../../utils/apiAuth.server';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';
import UnreachableCaseError from '../../utils/UnreachableCaseError';

const PROTOBUF_HEADERS = {'Content-Type': 'application/x-protobuf'};

const productListQuery = {
  product: {
    select: {
      name: true,
      price: true,
    },
    orderBy: {
      order: 'asc' as const,
    },
    take: 30,
  },
};

function getDeviceConfig(
  list: ProductList & {
    product: Array<{name: string; price: number}>;
  },
) {
  const deviceConfig: DeviceConfig = {
    listId: list.id,
    name: list.name,
    products: list.product,
    checksum: 0,
  };

  deviceConfig.checksum = crc32.buf(DeviceConfig.encode(deviceConfig).finish());
  return deviceConfig;
}

/**
 * GET /api/kultcash/config — returns the product list configured for the
 * requesting device, as an encoded `DeviceConfig` protobuf message.
 */
export async function handleConfig(device: DeviceToken): Promise<Response> {
  const result = await prismaClient.device.findUnique({
    where: {id: device.deviceId},
    include: {
      productList: {
        include: productListQuery,
      },
    },
  });

  const list = result?.productList;
  if (!list) {
    return new Response(null, {status: 204});
  }

  const message = DeviceConfig.encode(getDeviceConfig(list)).finish();
  return new Response(message.buffer as ArrayBuffer, {
    headers: PROTOBUF_HEADERS,
  });
}

/**
 * GET /api/kultcash/lists — returns all active product lists plus the set of
 * privileged / suspended crew cards, as an encoded `AllLists` protobuf message.
 * Supports `If-None-Match` for caching via the config CRC32.
 */
export async function handleLists(request: Request): Promise<Response> {
  const [lists, privilegedCrewCards, privilegeTokens, suspendedCrewCards] =
    await Promise.all([
      prismaClient.productList.findMany({
        where: {active: true},
        include: productListQuery,
        orderBy: {name: 'asc'},
      }),
      prismaClient.crewCard.findMany({
        where: {privileged: true, suspended: {not: true}},
        select: {id: true},
      }),
      prismaClient.devicePrivilegeToken.findMany({
        select: {id: true},
      }),
      prismaClient.crewCard.findMany({
        where: {suspended: true},
      }),
    ]);

  const allLists: AllLists = {
    productList: lists.map(getDeviceConfig),
    privilegeTokens: privilegeTokens
      .concat(privilegedCrewCards)
      .map(({id}) => new Uint8Array(id)),
    suspendedCrewCards: suspendedCrewCards.map(({id}) => new Uint8Array(id)),
    versionNumber: 0,
    timestamp: 0,
    checksum: 0,
  };
  allLists.checksum = crc32.buf(AllLists.encode(allLists).finish());

  const configVersion = await prismaClient.deviceConfigVersion.upsert({
    where: {crc32: allLists.checksum},
    create: {crc32: allLists.checksum},
    update: {},
  });
  allLists.versionNumber = configVersion.version;
  allLists.timestamp = Math.floor(configVersion.createdAt.getTime() / 1000);

  if (request.headers.get('if-none-match') === `"${allLists.checksum}"`) {
    return new Response(null, {status: 304});
  }

  const message = AllLists.encode(allLists).finish();
  return new Response(message.buffer as ArrayBuffer, {
    headers: {
      ...PROTOBUF_HEADERS,
      ETag: `"${allLists.checksum}"`,
    },
  });
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

  const {
    deviceTime: dt,
    deviceTimeIsUtc,
    deviceId,
    order,
    cardTransaction,
    crewCardEnrollment,
    ...data
  } = message;

  let deviceTime = new Date(dt * 1000);
  if (!deviceTimeIsUtc) {
    deviceTime = subMinutes(deviceTime, tzOffset('Europe/Berlin', deviceTime));
  }

  const orderCreate: Prisma.OrderCreateInput | undefined =
    order != null
      ? {
          payment: mapPayment(order.paymentMethod),
          createdAt: deviceTime,
          crewCard: order.crewCardId
            ? {
                connectOrCreate: {
                  where: {id: Uint8Array.from(order.crewCardId)},
                  create: {
                    // only necessary if crewCard enrollment is not uploaded yet
                    id: Uint8Array.from(order.crewCardId),
                    // do not further enroll card
                    validUntil: new Date(),
                    enrolledAt: deviceTime,
                  },
                },
              }
            : undefined,
          device: {connect: {id: deviceId}},
          items: {
            createMany: {
              data: order.cartItems
                .filter(({product}) => product != undefined)
                .map(({amount, product}) => ({
                  amount,
                  name: product!.name,
                  perUnitPrice: product!.price,
                  productListId: order.listId,
                })),
            },
          },
        }
      : undefined;

  await prismaClient.deviceLog
    .create({
      data: {
        ...data,
        deviceTime,
        device: {
          connectOrCreate: {
            create: {
              id: deviceId,
              lastSeen: new Date(),
              type: 'CONTACTLESS_TERMINAL' as const,
            },
            where: {id: deviceId},
          },
        },
        CardTransaction:
          cardTransaction != null
            ? {
                create: {
                  ...cardTransaction,
                  transactionType: mapTransactionType(
                    cardTransaction.transactionType,
                  ),
                  Order: order != null ? {create: orderCreate} : undefined,
                },
              }
            : undefined,
      },
    })
    .catch((e) => {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // client ID already exists
        throw new ApiError(409, 'Conflict');
      }
      throw e;
    });

  if (!cardTransaction && orderCreate) {
    // manually create order, because it's not part of a card transaction
    const createdOrder = await prismaClient.order.create({
      data: orderCreate,
    });

    if (createdOrder.crewCardId) {
      await enqueueGcpTask('badge-awarded', {orderId: createdOrder.id});
    }
  }

  if (crewCardEnrollment) {
    const validUntil = kultEpochToDate(crewCardEnrollment.validUntil);
    const crewCardData = {
      id: Uint8Array.from(crewCardEnrollment.crewCardId),
      validUntil,
      // resetting
      viewerId: null,
      nickname: null,
      suspended: false,
      privileged: false,
      enrolledAt: deviceTime,
    };
    await prismaClient.crewCard.upsert({
      where: {id: crewCardData.id},
      update: crewCardData,
      create: crewCardData,
    });

    await enqueueGcpTask('crew-card-enrolled', {
      crewCardId: Array.from(crewCardData.id),
      validUntil: validUntil.toISOString(),
    });
  }

  return new Response('Created', {status: 201});
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
