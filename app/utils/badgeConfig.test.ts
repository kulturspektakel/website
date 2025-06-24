import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest';
import {badgeConfig} from './badgeConfig';
import {CardTransactionType} from '@prisma/client';
import {CardActivity} from '../components/kultcard/CardActivities';
import {sub} from 'date-fns';

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
    order({
      productList: 'Schokofrüchte',
      time: new Date('2025-07-27 15:20:00+02:00'),
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
        target: 9,
        current: 8,
      },
    });

    expect(badgeConfig.bucketlist.compute(orders.slice(0, 6), event)).toEqual({
      status: 'not awarded',
      progress: {
        target: 9,
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
        target: 9,
        current: 0,
      },
    });
  });
});

describe('tierfreundin', () => {
  test('awarded', () => {
    expect(
      badgeConfig.tierfreundin.compute(
        [
          order({
            productList: 'Hot Dog',
            items: [
              {
                name: 'Hot Dog (vegetarisch)',
                amount: 1,
              },
            ],
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
});

describe('kalle', () => {
  test('awards if purchased "Weißbier" and "Vodka Bull" in sixty minutes or less', () => {
    expect(
      badgeConfig.kalle.compute(
        [
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [{name: 'Weißbier', amount: 1}],
          }),
          order({
            productList: 'Cocktail',
            time: new Date('2025-07-27 11:30:00+02:00'),
            items: [{name: 'Vodka Bull', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 11:30:00+02:00'),
    });

    expect(
      badgeConfig.kalle.compute(
        [
          order({
            productList: 'Cocktail',
            time: new Date('2025-07-27 10:00:00+02:00'),
            items: [{name: 'Vodka Bull', amount: 1}],
          }),
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:05:00+02:00'),
            items: [{name: 'Weißbier', amount: 1}],
          }),
          order({
            productList: 'Cocktail',
            time: new Date('2025-07-27 11:30:00+02:00'),
            items: [{name: 'Vodka Bull', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 11:30:00+02:00'),
    });
  });

  test('does not award for if none of the two products have been purchased', () => {
    expect(
      badgeConfig.kalle.compute(
        [
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [{name: 'Obstler', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 2,
        current: 0,
      },
    });
  });

  test('correctly shows progress if one has been purchased in the last 60mins', () => {
    expect(
      badgeConfig.kalle.compute(
        [
          order({
            productList: 'Weißbiergarten',
            time: sub(new Date(), {minutes: 30}),
            items: [{name: 'Weißbier', amount: 1}],
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

    expect(
      badgeConfig.kalle.compute(
        [
          order({
            productList: 'Cocktail',
            time: sub(new Date(), {minutes: 20}),
            items: [{name: 'Vodka Bull', amount: 1}],
          }),
          order({
            productList: 'Weißbiergarten',
            time: sub(new Date(), {hours: 3}),
            items: [{name: 'Weißbier', amount: 1}],
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

  test('does not show progress if one has been purchased, but not in the last 60 minutes', () => {
    expect(
      badgeConfig.kalle.compute(
        [
          order({
            productList: 'Weißbiergarten',
            time: sub(new Date(), {hours: 3}),
            items: [{name: 'Weißbier', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 2,
        current: 0,
      },
    });
  });
});

describe('rothy', () => {
  test('none', () => {
    expect(
      badgeConfig.rothy.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date(),
            items: [{name: 'Wasser', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });

  test('awarded', () => {
    expect(
      badgeConfig.rothy.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2000-01-01 00:00:01'),
            items: [
              {name: 'Spezi', amount: 1},
              {name: 'Limo', amount: 1},
              {name: 'Helles', amount: 1},
            ],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2000-01-01 00:00:01'),
    });
  });
});

describe('flash', () => {
  beforeAll(() => {
    vi.setSystemTime(new Date('2025-07-26 19:00:00+02:00'));
  });

  afterAll(() => {
    // reset mocked time
    vi.useRealTimers();
  });

  test('none', () => {
    expect(
      badgeConfig.flash.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 18:00:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 2,
        current: 0,
      },
    });
  });

  test('one at WB', () => {
    expect(
      badgeConfig.flash.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 18:58:00+02:00'),
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

  test('one at GB', () => {
    expect(
      badgeConfig.flash.compute(
        [
          order({
            productList: 'Hot Dog',
            time: new Date('2025-07-26 18:58:00+02:00'),
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

  test('both: GB first', () => {
    expect(
      badgeConfig.flash.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 10:58:00+02:00'),
          }),
          order({
            productList: 'Hot Dog',
            time: new Date('2025-07-26 10:57:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 10:58:00+02:00'),
    });
  });

  test('both: WB first', () => {
    expect(
      badgeConfig.flash.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 10:55:00+02:00'),
          }),
          order({
            productList: 'Hot Dog',
            time: new Date('2025-07-26 10:57:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 10:57:00+02:00'),
    });
  });

  test('Too much time between', () => {
    expect(
      badgeConfig.flash.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 10:55:00+02:00'),
          }),
          order({
            productList: 'Hot Dog',
            time: new Date('2025-07-26 11:00:01+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 2,
        current: 0,
      },
    });
  });
});

describe('dauercamper', () => {
  test('one day event', () => {
    expect(
      badgeConfig.dauercamper.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 23:56:00+02:00'),
          }),
        ],
        {
          start: new Date('2025-07-26 23:55:00+02:00'),
          end: new Date('2025-07-26 23:57:00+02:00'),
        },
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 23:56:00+02:00'),
    });
  });

  test('one of three day event', () => {
    expect(
      badgeConfig.dauercamper.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 23:56:00+02:00'),
          }),
        ],
        {
          start: new Date('2025-07-25 23:55:00+02:00'),
          end: new Date('2025-07-27 00:00:01+02:00'),
        },
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 3,
        current: 1,
      },
    });
  });

  test('three of three day event', () => {
    expect(
      badgeConfig.dauercamper.compute(
        [
          order({
            productList: 'Italien',
            time: new Date('2025-07-25 23:56:00+02:00'),
          }),
          order({
            productList: 'Italien',
            time: new Date('2025-07-26 23:56:00+02:00'),
          }),
          order({
            productList: 'Italien',
            time: new Date('2025-07-27 06:00:01+02:00'),
          }),
        ],
        {
          start: new Date('2025-07-25 23:55:00+02:00'),
          end: new Date('2025-07-27 06:00:02+02:00'),
        },
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 06:00:01+02:00'),
    });
  });
});

describe('investor', () => {
  test('50 euro top up', () => {
    expect(
      badgeConfig.investor.compute(
        [
          {
            type: 'generic',
            transactionType: 'TopUp',
            balanceAfter: 5000,
            balanceBefore: 0,
            depositBefore: 0,
            depositAfter: 0,
            time: new Date('2025-07-27 06:00:01+02:00'),
          },
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 06:00:01+02:00'),
    });
  });
});

describe('spendierhosen', () => {
  test('awards if bought >= 3 beers in one order', () => {
    expect(
      badgeConfig.spendierhosen.compute(
        [
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [
              {name: 'Helles', amount: 3},
              {name: 'Weißbier', amount: 1},
            ],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 11:00:00+02:00'),
    });
  });

  test('does not award if less than 3 beers in one order', () => {
    expect(
      badgeConfig.spendierhosen.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [{name: 'Helles', amount: 2}],
          }),
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [{name: 'Weißbier', amount: 2}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });
});

describe('hydradtionHomie', () => {
  test('progress', () => {
    expect(
      badgeConfig.hydrationHomie.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [{name: 'Wasser', amount: 2}],
          }),
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [{name: 'Wasser', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 5,
        current: 3,
      },
    });
  });

  test('awarded', () => {
    expect(
      badgeConfig.hydrationHomie.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-27 11:00:00+02:00'),
            items: [{name: 'Wasser', amount: 2}],
          }),
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-27 11:00:01+02:00'),
            items: [{name: 'Wasser', amount: 3}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-27 11:00:01+02:00'),
    });
  });
});
