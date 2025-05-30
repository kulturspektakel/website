import {describe, expect, test} from 'vitest';
import {badgeConfig} from './badgeConfig';
import {CardTransactionType} from '@prisma/client';
import {CardActivity} from '../components/kultcard/CardActivities';

const event = Object.freeze({
  start: new Date('2025-07-25 16:00:00+02:00'),
  end: new Date('2025-07-27 23:00:00+02:00'),
});

function topUp(at: Date): CardActivity {
  return {
    type: 'generic' as const,
    time: at,
    balanceBefore: 0,
    balanceAfter: 100,
    depositBefore: 0,
    depositAfter: 0,
    transactionType: CardTransactionType.TopUp,
  };
}

function order(
  data: Partial<Omit<Extract<CardActivity, {type: 'order'}>, 'order'>>,
): CardActivity {
  return {
    type: 'order' as const,
    productList: 'Ausschank',
    emoji: null,
    items: [{amount: 1, name: 'Helles'}],
    time: new Date(),
    ...data,
  };
}

test('no badge is awarded by default', () => {
  Object.keys(badgeConfig).forEach((key) => {
    expect(badgeConfig[key].compute([], event).status).toBe('not awarded');
  });
});

describe('earlyBird', () => {
  test('awards in the first hour', () => {
    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-25 16:00:00+02:00'))],
        event,
      ).status,
    ).toBe('awarded');

    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-26 15:00:01+02:00'))],
        event,
      ).status,
    ).toBe('awarded');

    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-27 10:30:00+02:00'))],
        event,
      ).status,
    ).toBe('awarded');
  });

  test('does not award before', () => {
    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-25 15:59:59+02:00'))],
        event,
      ).status,
    ).toBe('not awarded');

    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-26 14:59:59+02:00'))],
        event,
      ).status,
    ).toBe('not awarded');

    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-27 09:59:59+02:00'))],
        event,
      ).status,
    ).toBe('not awarded');
  });

  test('does not award after', () => {
    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-25 17:00:01+02:00'))],
        event,
      ).status,
    ).toBe('not awarded');

    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-26 16:00:01+02:00'))],
        event,
      ).status,
    ).toBe('not awarded');

    expect(
      badgeConfig.earlyBird.compute(
        [topUp(new Date('2025-07-27 11:00:01+02:00'))],
        event,
      ).status,
    ).toBe('not awarded');
  });
});

describe('lokalPatriot', () => {
  test('awards for both', () => {
    expect(
      badgeConfig.lokalPatriot.compute(
        [
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:00+02:00'),
          }),
          order({
            productList: 'Frühschoppen',
            time: new Date('2025-07-27 10:30:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 11:00:00+02:00'),
    });

    expect(
      badgeConfig.lokalPatriot.compute(
        [
          order({
            productList: 'Weißbierbar',
            time: new Date('2025-07-27 10:00:00+02:00'),
          }),
          order({
            productList: 'Frühschoppen',
            time: new Date('2025-07-27 10:30:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 10:30:00+02:00'),
    });
  });

  test('one missing', () => {
    expect(
      badgeConfig.lokalPatriot.compute(
        [
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 2,
        current: 1,
      },
    });
  });

  test('both missing', () => {
    expect(badgeConfig.lokalPatriot.compute([], event)).toEqual({
      status: 'not awarded',
      progress: {
        target: 2,
        current: 0,
      },
    });
  });
});

describe('bucketList', () => {
  const orders = [
    order({
      productList: 'Weißbiergarten',
      time: new Date('2025-07-27 11:00:00+02:00'),
    }),
    order({
      productList: 'Empanadas',
      time: new Date('2025-07-27 10:30:00+02:00'),
    }),
    order({
      productList: 'Grill',
      time: new Date('2025-07-27 11:30:00+02:00'),
    }),
    order({
      productList: 'Frittiererei',
      time: new Date('2025-07-27 12:30:00+02:00'),
    }),
    order({
      productList: 'Hot Dog',
      time: new Date('2025-07-27 12:00:00+02:00'),
    }),
    order({
      productList: 'Italien',
      time: new Date('2025-07-27 13:30:00+02:00'),
    }),
    order({
      productList: 'Waffel',
      time: new Date('2025-07-27 15:00:00+02:00'),
    }),
  ];

  test('awards if has activities from all productLists', () => {
    expect(
      badgeConfig.bucketlist.compute(
        [
          ...orders,
          order({
            productList: 'Pizza',
            time: new Date('2025-07-27 18:00:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 18:00:00+02:00'),
    });
  });

  test('shows correct progress if not all productLists are ordered', () => {
    expect(badgeConfig.bucketlist.compute(orders, event)).toEqual({
      status: 'not awarded',
      progress: {
        target: 8,
        current: 7,
      },
    });

    expect(badgeConfig.bucketlist.compute(orders.slice(0, 6), event)).toEqual({
      status: 'not awarded',
      progress: {
        target: 8,
        current: 6,
      },
    });
  });

  test('only counts orders from allowlisted productLists', () => {
    expect(
      badgeConfig.bucketlist.compute(
        [
          order({
            productList: 'EKP',
            time: new Date('2025-07-27 11:00:00+02:00'),
          }),
          order({
            productList: 'Frühschoppen',
            time: new Date('2025-07-27 10:30:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 8,
        current: 0,
      },
    });
  });
});
