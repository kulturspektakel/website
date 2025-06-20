import {beforeAll, describe, expect, test, assert} from 'vitest';
import {transformCardAvtivities} from './cardUtils';
import {decodePayload} from './decodePayload';

describe('decodePayload', () => {
  beforeAll(() => {
    process.env.CONTACTLESS_SALT = 'TEST_SALT';
  });
  test('kultcard', () => {
    const result = decodePayload('kultcard', 'qqu8zd7v_wIACmQA4nDijgs');
    expect(result.cardId).toBe('AAABBCCDDEEFFF');
    expect(result.balance).toBe(100);
    expect(result.deposit).toBe(10);
    expect(result.counter).toBe(2);
  });

  test('crewcard', () => {
    const result = decodePayload('crewcard', 'qqu8zd7v_wIACmQA4nDijgs');
    expect(result.cardId).toBe('AAABBCCDDEEFFF');
    expect(result.validUntil).toStrictEqual(
      new Date('2025-01-04T04:00:00.000Z'),
    );
  });

  test('invalid card signature', () => {
    assert.throws(
      () => decodePayload('kultcard', 'qqu8zd7v_wIACmQA4nDijg_'),
      'Invalid signature',
    );
  });

  test('invalid length', () => {
    assert.throws(() => decodePayload('kultcard', '1'), 'Wrong payload length');
  });

  test('invalid payload', () => {
    assert.throws(
      () => decodePayload('kultcard', '@#$%^&*@#$%^&*@#$%^&*@$'),
      'Invalid signature',
    );
  });
});

describe('transformCardAvtivities', () => {
  function order(order) {
    return {
      balanceAfter: 0,
      balanceBefore: 600,
      depositAfter: 1,
      depositBefore: 0,
      counter: 3,
      cardId: 'cardid',
      transactionType: 'Charge',
      DeviceLog: {
        deviceTime: new Date('2000-01-01'),
      },
      Order: {
        createdAt: new Date('2000-01-01'),
        OrderItem: [
          {
            amount: 1,
            name: 'Helles',
            ProductList: {
              name: 'Ausschank',
              emoji: '🍺',
            },
          },
        ],
      },
      ...order,
    };
  }

  test('no transactions', () => {
    const activites = transformCardAvtivities([], 0, 0, 0);
    expect(activites.length).toBe(0);
  });

  test('only a missing transactions', () => {
    const activites = transformCardAvtivities([], 1, 0, 0);
    expect(activites.length).toBe(0);
  });

  test('missing latest', () => {
    const activites = transformCardAvtivities(
      [order({counter: 1})],
      3,
      1000,
      3,
    );
    expect(activites.length).toBe(2);
    expect(activites[0]).toEqual({
      balanceAfter: 1000,
      balanceBefore: 0,
      depositAfter: 3,
      depositBefore: 1,
      numberOfMissingTransactions: 2,
      type: 'missing',
    });
    expect(activites[1]).toEqual({
      cardChange: {
        balanceAfter: 0,
        balanceBefore: 600,
        depositAfter: 1,
        depositBefore: 0,
      },
      emoji: '🍺',
      items: [
        {
          amount: 1,
          name: 'Helles',
        },
      ],
      productList: 'Ausschank',
      time: new Date('2000-01-01'),
      type: 'order',
    });
  });

  test('missing inbetween', () => {
    const activites = transformCardAvtivities(
      [order({counter: 3}), order({counter: 1})],
      3,
      1000,
      3,
    );
    expect(activites.length).toBe(3);
    expect(activites[0].type).toMatch('order');
    expect(activites[1]).toMatchObject({
      numberOfMissingTransactions: 1,
      type: 'missing',
    });
    expect(activites[2].type).toMatch('order');
  });

  test('missing first', () => {
    const activites = transformCardAvtivities(
      [order({counter: 2})],
      2,
      1000,
      3,
    );
    expect(activites.length).toBe(1);
    expect(activites[0].type).toBe('order');
  });

  test('top up', () => {
    const activites = transformCardAvtivities(
      [
        {
          balanceAfter: 1000,
          balanceBefore: 0,
          depositAfter: 0,
          depositBefore: 0,
          counter: 1,
          cardId: 'cardid',
          transactionType: 'TopUp',
          DeviceLog: {
            deviceTime: new Date('2000-01-01'),
          },
          Order: null,
        },
      ],
      1,
      1000,
      3,
    );

    expect(activites.length).toBe(1);
    expect(activites[0]).toMatchObject({
      type: 'generic',
      transactionType: 'TopUp',
      balanceAfter: 1000,
      balanceBefore: 0,
      depositAfter: 0,
      depositBefore: 0,
    });
  });

  test('newer transactions are ignored', () => {
    const activites = transformCardAvtivities(
      [order({counter: 3})],
      2,
      1000,
      2,
    );
    expect(activites.length).toBe(0);
  });

  test('Cashouts are cut off', () => {
    const activites = transformCardAvtivities(
      [
        order({counter: 3}),
        {
          balanceAfter: 0,
          balanceBefore: 1000,
          depositAfter: 0,
          depositBefore: 0,
          counter: 1,
          cardId: 'cardid',
          transactionType: 'Cashout',
          DeviceLog: {
            deviceTime: new Date('2000-01-01'),
          },
          Order: null,
        },
      ],
      3,
      1000,
      2,
    );
    expect(activites.length).toBe(1);
    expect(activites[0]).toMatchObject({
      type: 'order',
    });
  });

  test('Donations are cut off', () => {
    const activites = transformCardAvtivities(
      [
        order({counter: 3}),
        {
          balanceAfter: 0,
          balanceBefore: 1000,
          depositAfter: 0,
          depositBefore: 0,
          counter: 1,
          cardId: 'cardid',
          transactionType: 'Donation',
          DeviceLog: {
            deviceTime: new Date('2000-01-01'),
          },
          Order: null,
        },
      ],
      3,
      1000,
      2,
    );
    expect(activites.length).toBe(1);
    expect(activites[0]).toMatchObject({
      type: 'order',
    });
  });
});
