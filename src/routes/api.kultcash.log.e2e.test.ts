import {describe, test, expect} from 'vitest';
import {baseUrl, deviceHeaders, query} from '../../test/e2e/client';
import {
  LogMessage,
  LogMessage_CardTransaction_TransactionType as TxType,
  LogMessage_Order_PaymentMethod as Payment,
} from '../proto/logmessage';

const headers = deviceHeaders('KASSE-LOG');

const post = (msg: LogMessage) =>
  fetch(`${baseUrl}/api/kultcash/log`, {
    method: 'POST',
    headers,
    body: LogMessage.encode(msg).finish(),
  });

// 2025-01-01T00:00:00Z
const deviceTime = 1_735_689_600;
const base = {deviceId: 'KASSE-LOG', deviceTime, deviceTimeIsUtc: true};

describe('POST /api/kultcash/log', () => {
  test('rejects an undecodable / empty body with 400', async () => {
    const res = await fetch(`${baseUrl}/api/kultcash/log`, {
      method: 'POST',
      headers,
      body: new Uint8Array(),
    });
    expect(res.status).toBe(400);
  });

  test('persists the log (incl. voltages) and dedupes a replayed clientId with 409', async () => {
    const clientId = 'log-client-1';
    const msg = LogMessage.create({
      ...base,
      clientId,
      batteryVoltage: 4100,
      usbVoltage: 5000,
    });

    const first = await post(msg);
    expect(first.status).toBe(201);

    const rows = await query<{batteryVoltage: number; usbVoltage: number}>(
      `select "batteryVoltage", "usbVoltage" from "DeviceLog" where "clientId" = $1`,
      [clientId],
    );
    expect(rows).toEqual([{batteryVoltage: 4100, usbVoltage: 5000}]);

    // same clientId again -> unique violation surfaced as 409
    const replay = await post(msg);
    expect(replay.status).toBe(409);
  });

  test('card transaction with an order persists transaction + order + items', async () => {
    const clientId = 'log-charge';
    const res = await post(
      LogMessage.create({
        ...base,
        clientId,
        cardTransaction: {
          transactionType: TxType.CHARGE,
          balanceBefore: 1000,
          balanceAfter: 600,
          depositBefore: 200,
          depositAfter: 200,
          cardId: 'CARD-ABC',
          counter: 5,
        },
        order: {
          paymentMethod: Payment.KULT_CARD,
          cartItems: [{amount: 2, product: {name: 'Bier', price: 200}}],
        },
      }),
    );
    expect(res.status).toBe(201);

    const [tx] = await query<{
      transactionType: string;
      cardId: string;
      balanceAfter: number;
      counter: number;
      orderId: number | null;
    }>(
      `select "transactionType", "cardId", "balanceAfter", counter, "orderId"
       from "CardTransaction" where "clientId" = $1`,
      [clientId],
    );
    expect(tx).toMatchObject({
      transactionType: 'Charge',
      cardId: 'CARD-ABC',
      balanceAfter: 600,
      counter: 5,
    });
    expect(tx.orderId).not.toBeNull();

    const [order] = await query<{payment: string}>(
      `select payment from "Order" where id = $1`,
      [tx.orderId],
    );
    expect(order.payment).toBe('KULT_CARD');

    const items = await query<{
      amount: number;
      name: string;
      perUnitPrice: number;
    }>(
      `select amount, name, "perUnitPrice" from "OrderItem" where "orderId" = $1`,
      [tx.orderId],
    );
    expect(items).toEqual([{amount: 2, name: 'Bier', perUnitPrice: 200}]);
  });

  test('card transaction without an order persists only the transaction', async () => {
    const clientId = 'log-topup';
    const res = await post(
      LogMessage.create({
        ...base,
        clientId,
        cardTransaction: {
          transactionType: TxType.TOP_UP,
          balanceBefore: 0,
          balanceAfter: 1000,
          depositBefore: 0,
          depositAfter: 200,
          cardId: 'CARD-TOPUP',
        },
      }),
    );
    expect(res.status).toBe(201);

    const [tx] = await query<{transactionType: string; orderId: number | null}>(
      `select "transactionType", "orderId" from "CardTransaction" where "clientId" = $1`,
      [clientId],
    );
    expect(tx.transactionType).toBe('TopUp');
    expect(tx.orderId).toBeNull();
  });

  test('order without a card transaction is created on its own', async () => {
    const clientId = 'log-order-cash';
    const crewCardId = [0xaa, 0xbb, 0xcc, 0xdd];
    const res = await post(
      LogMessage.create({
        ...base,
        clientId,
        order: {
          paymentMethod: Payment.FREE_CREW,
          crewCardId: Uint8Array.from(crewCardId),
          cartItems: [{amount: 1, product: {name: 'Wasser', price: 0}}],
        },
      }),
    );
    expect(res.status).toBe(201);

    // no card transaction was created for this log
    const txs = await query(
      `select 1 from "CardTransaction" where "clientId" = $1`,
      [clientId],
    );
    expect(txs).toHaveLength(0);

    // the order exists, keeps the crew card's serial, and has its item
    const [order] = await query<{id: number; payment: string}>(
      `select o.id, o.payment from "Order" o
       where o."crewCardSerial" = $1 and o.payment = 'FREE_CREW'`,
      [Buffer.from(crewCardId)],
    );
    expect(order?.payment).toBe('FREE_CREW');
    const items = await query(
      `select 1 from "OrderItem" where "orderId" = $1`,
      [order.id],
    );
    expect(items).toHaveLength(1);
  });

  test('order with a known listId stores it on the items', async () => {
    const clientId = 'log-order-list';
    const [{id: listId}] = await query<{id: number}>(
      `insert into "ProductList" (name) values ('Test') returning id`,
    );
    const res = await post(
      LogMessage.create({
        ...base,
        clientId,
        order: {
          paymentMethod: Payment.CASH,
          listId,
          cartItems: [{amount: 1, product: {name: 'Bier', price: 200}}],
        },
      }),
    );
    expect(res.status).toBe(201);

    const items = await query<{productListId: number | null}>(
      `select oi."productListId" from "OrderItem" oi
       join "Order" o on o.id = oi."orderId"
       where o.payment = 'CASH' and oi.name = 'Bier' and oi."productListId" = $1`,
      [listId],
    );
    expect(items).toHaveLength(1);
  });

  test('order referencing an unknown listId is rejected with 400', async () => {
    const res = await post(
      LogMessage.create({
        ...base,
        clientId: 'log-order-bad-list',
        order: {
          paymentMethod: Payment.CASH,
          listId: 999_999,
          cartItems: [{amount: 1, product: {name: 'Bier', price: 200}}],
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  test('re-enrolling a live card renews it for the same holder', async () => {
    const serial = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const [{id: holderId}] = await query<{id: string}>(
      `insert into "CrewCardHolder" (nickname, "pageToken")
       values ('renewed', 'renew-token') returning id`,
    );
    await query(
      `insert into "CrewCard" (serial, "cardType", "holderId", "validUntil", "enrolledAt")
       values ($1, 'PHYSICAL', $2, '2025-01-01', '2024-07-01')`,
      [serial, holderId],
    );

    const res = await post(
      LogMessage.create({
        ...base,
        clientId: 'log-renew',
        crewCardEnrollment: {
          crewCardId: Uint8Array.from(serial),
          validUntil: 3,
        },
      }),
    );
    expect(res.status).toBe(201);

    const cards = await query<{
      holderId: string;
      suspendedAt: Date | null;
      validUntil: Date;
      enrolledAt: number;
      reenrolledAt: number;
    }>(
      `select "holderId", "suspendedAt", "validUntil",
              extract(epoch from "enrolledAt")::int as "enrolledAt",
              extract(epoch from "reenrolledAt")::int as "reenrolledAt"
       from "CrewCard" where serial = $1`,
      [serial],
    );
    // The same card: holder and order window start kept, validity renewed.
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({holderId, suspendedAt: null});
    expect(cards[0].validUntil > new Date('2025-01-01')).toBe(true);
    expect(cards[0].enrolledAt).toBe(
      new Date('2024-07-01T00:00:00Z').getTime() / 1000,
    );
    expect(cards[0].reenrolledAt).toBe(deviceTime);
    expect(
      await query(`select 1 from "CrewCardEnrollment" where serial = $1`, [
        serial,
      ]),
    ).toHaveLength(0);
  });

  test('enrolling a chip without a live card creates an enrollment', async () => {
    const serial = Buffer.from([0x05, 0x06, 0x07, 0x08]);
    const res = await post(
      LogMessage.create({
        ...base,
        clientId: 'log-enroll',
        crewCardEnrollment: {
          crewCardId: Uint8Array.from(serial),
          validUntil: 3,
        },
      }),
    );
    expect(res.status).toBe(201);

    const [enrollment] = await query<{enrolledAt: number; deviceId: string}>(
      `select extract(epoch from "enrolledAt")::int as "enrolledAt", "deviceId"
       from "CrewCardEnrollment" where serial = $1`,
      [serial],
    );
    expect(enrollment).toEqual({enrolledAt: deviceTime, deviceId: 'KASSE-LOG'});
    expect(
      await query(`select 1 from "CrewCard" where serial = $1`, [serial]),
    ).toHaveLength(0);
  });
});
