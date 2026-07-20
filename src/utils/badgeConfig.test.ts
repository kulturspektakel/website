import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest';
import {badgeConfig, type BadgeKey} from './badgeConfig';
import {CardTransactionType} from '../generated/prisma/browser';
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
    expect(badgeConfig[key as BadgeKey].compute([], event).status).toBe('not awarded');
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
      productList: 'Hot Dogs',
      time: new Date('2025-07-27 12:00:00+02:00'),
    }),
    order({
      productList: 'Wein & Italien',
      time: new Date('2025-07-27 13:30:00+02:00'),
    }),
    order({
      productList: 'Waffeln',
      time: new Date('2025-07-27 15:00:00+02:00'),
    }),
    order({
      productList: 'Burger',
      time: new Date('2025-07-27 15:20:00+02:00'),
    }),
    order({
      productList: 'Crêpes',
      time: new Date('2025-07-27 16:00:00+02:00'),
    }),
    order({
      productList: 'Wraps',
      time: new Date('2025-07-27 16:30:00+02:00'),
    }),
    order({
      productList: 'Käsespätzle',
      time: new Date('2025-07-27 17:00:00+02:00'),
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
        target: 12,
        current: 11,
      },
    });

    expect(badgeConfig.bucketlist.compute(orders.slice(0, 6), event)).toEqual({
      status: 'not awarded',
      progress: {
        target: 12,
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
        target: 12,
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
            productList: 'Wein & Italien',
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
            productList: 'Wein & Italien',
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
            productList: 'Hot Dogs',
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
            productList: 'Wein & Italien',
            time: new Date('2025-07-26 10:58:00+02:00'),
          }),
          order({
            productList: 'Hot Dogs',
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
            productList: 'Wein & Italien',
            time: new Date('2025-07-26 10:55:00+02:00'),
          }),
          order({
            productList: 'Hot Dogs',
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
            productList: 'Wein & Italien',
            time: new Date('2025-07-26 10:55:00+02:00'),
          }),
          order({
            productList: 'Hot Dogs',
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

describe('keineTermine', () => {
  test('less than 6 hours', () => {
    expect(
      badgeConfig.keineTermine.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 16:00:00+02:00'),
          }),
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-25 21:59:59+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });

  test('more than 6 hours, but different days', () => {
    expect(
      badgeConfig.keineTermine.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 16:00:00+02:00'),
          }),
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-26 21:59:59+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });

  test('more than 6 hours', () => {
    expect(
      badgeConfig.keineTermine.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 16:00:00+02:00'),
          }),
          order({
            productList: 'Weißbiergarten',
            time: new Date('2025-07-25 22:01:00+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-25 22:01:00+02:00'),
    });
  });
});

describe('weinAufBier', () => {
  test('still possible', () => {
    vi.setSystemTime(new Date('2025-07-26 19:00:00+02:00'));

    expect(
      badgeConfig.weinAufBier.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-26 16:00:00+02:00'),
            items: [
              {
                name: 'Helles',
                amount: 1,
              },
            ],
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

    // reset mocked time
    vi.useRealTimers();
  });

  test('awarded', () => {
    expect(
      badgeConfig.weinAufBier.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 16:00:00+02:00'),
            items: [
              {
                name: 'Helles',
                amount: 1,
              },
            ],
          }),
          order({
            productList: 'Italien',
            time: new Date('2025-07-25 21:59:59+02:00'),
            items: [
              {
                name: 'Weißwein 0,2l',
                amount: 1,
              },
            ],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-25 21:59:59+02:00'),
    });
  });
});

describe('wieImmer', () => {
  test('progress', () => {
    expect(
      badgeConfig.wieImmer.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 16:00:00+02:00'),
            items: [
              {
                name: 'Helles',
                amount: 1,
              },
            ],
          }),
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 21:59:59+02:00'),
            items: [
              {
                name: 'Helles',
                amount: 2,
              },
            ],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 3,
        current: 2,
      },
    });
  });

  test('awarded', () => {
    expect(
      badgeConfig.wieImmer.compute(
        [
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 16:00:00+02:00'),
            items: [
              {
                name: 'Helles',
                amount: 1,
              },
            ],
          }),
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 21:59:59+02:00'),
            items: [
              {
                name: 'Helles',
                amount: 2,
              },
            ],
          }),
          order({
            productList: 'Ausschank',
            time: new Date('2025-07-25 23:59:59+02:00'),
            items: [
              {
                name: 'Helles',
                amount: 2,
              },
            ],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-25 23:59:59+02:00'),
    });
  });
});

describe('globetrotter', () => {
  test('progress', () => {
    expect(
      badgeConfig.globetrotter.compute(
        [
          order({
            productList: 'Grill',
          }),
          order({
            productList: 'Grill',
          }),
          order({
            productList: 'Waffel',
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 4,
        current: 2,
      },
    });
  });

  test('awarded', () => {
    expect(
      badgeConfig.globetrotter.compute(
        [
          order({
            productList: 'Grill',
            time: new Date('2025-07-25 23:59:59+02:00'),
          }),
          order({
            productList: 'Wein & Italien',
            time: new Date('2025-07-25 23:59:59+02:00'),
          }),
          order({
            productList: 'Cocktail',
            time: new Date('2025-07-25 23:59:59+02:00'),
          }),
          order({
            productList: 'Waffel',
            time: new Date('2025-07-26 23:59:59+02:00'),
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 23:59:59+02:00'),
    });
  });
});

test('bleifrei', () => {
  expect(
    badgeConfig.bleifrei.compute(
      [
        order({
          productList: 'Cocktail',
          time: new Date('2025-07-25 23:59:59+02:00'),
          items: [{name: 'Alkoholfreier Cocktail', amount: 1}],
        }),
      ],
      event,
    ),
  ).toEqual({
    status: 'awarded',
    awardedAt: new Date('2025-07-25 23:59:59+02:00'),
  });
});

describe('feierabendbier', () => {
  test('awarded when the first beer of the day is after 22:00', () => {
    expect(
      badgeConfig.feierabendbier.compute(
        [order({time: new Date('2025-07-25 22:30:00+02:00')})],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-25 22:30:00+02:00'),
    });
  });

  test('not awarded when a beer was bought earlier that day', () => {
    expect(
      badgeConfig.feierabendbier.compute(
        [
          order({time: new Date('2025-07-25 19:00:00+02:00')}),
          order({time: new Date('2025-07-25 23:00:00+02:00')}),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });

  test('not awarded when the only beer is before 22:00', () => {
    expect(
      badgeConfig.feierabendbier.compute(
        [order({time: new Date('2025-07-25 21:00:00+02:00')})],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });

  test('counts per day: an early beer on another day does not disqualify', () => {
    expect(
      badgeConfig.feierabendbier.compute(
        [
          // Friday: first beer before 22:00 → Friday disqualified
          order({time: new Date('2025-07-25 19:00:00+02:00')}),
          // Saturday: first beer after 22:00 → still awarded
          order({time: new Date('2025-07-26 23:00:00+02:00')}),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 23:00:00+02:00'),
    });
  });
});

describe('konterhalbe', () => {
  test('awarded for a beer in the morning window (6:00–12:00)', () => {
    expect(
      badgeConfig.konterhalbe.compute(
        [order({time: new Date('2025-07-26 09:00:00+02:00')})],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 09:00:00+02:00'),
    });
  });

  test('not awarded for a beer before 6:00 or from noon onwards', () => {
    expect(
      badgeConfig.konterhalbe.compute(
        [
          order({time: new Date('2025-07-26 05:30:00+02:00')}),
          order({time: new Date('2025-07-26 12:00:00+02:00')}),
          order({time: new Date('2025-07-26 20:00:00+02:00')}),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });
});

describe('zuckerrausch', () => {
  test('awarded for 3 sugar products within an hour', () => {
    expect(
      badgeConfig.zuckerrausch.compute(
        [
          order({
            time: new Date('2025-07-26 14:00:00+02:00'),
            items: [{name: 'Kuchen', amount: 1}],
          }),
          order({
            time: new Date('2025-07-26 14:30:00+02:00'),
            items: [{name: 'Waffel', amount: 1}],
          }),
          order({
            time: new Date('2025-07-26 14:59:00+02:00'),
            items: [{name: 'Schoko', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 14:59:00+02:00'),
    });
  });

  test('awarded when a single order contains 3 sugar products', () => {
    expect(
      badgeConfig.zuckerrausch.compute(
        [
          order({
            time: new Date('2025-07-26 14:00:00+02:00'),
            items: [{name: 'Schoko-Banane', amount: 3}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 14:00:00+02:00'),
    });
  });

  test('not awarded when the 3 sugar products span more than an hour', () => {
    expect(
      badgeConfig.zuckerrausch.compute(
        [
          order({
            time: new Date('2025-07-26 14:00:00+02:00'),
            items: [{name: 'Kuchen', amount: 1}],
          }),
          order({
            time: new Date('2025-07-26 14:30:00+02:00'),
            items: [{name: 'Waffel', amount: 1}],
          }),
          order({
            time: new Date('2025-07-26 15:01:00+02:00'),
            items: [{name: 'Schoko', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
      progress: {
        target: 3,
        current: 2,
      },
    });
  });
});

describe('erreichbarBleiben', () => {
  test('awarded when "Handy laden" was purchased', () => {
    expect(
      badgeConfig.erreichbarBleiben.compute(
        [
          order({
            time: new Date('2025-07-26 14:00:00+02:00'),
            items: [{name: 'Handy laden', amount: 1}],
          }),
        ],
        event,
      ),
    ).toEqual({
      status: 'awarded',
      awardedAt: new Date('2025-07-26 14:00:00+02:00'),
    });
  });

  test('not awarded without "Handy laden"', () => {
    expect(
      badgeConfig.erreichbarBleiben.compute(
        [order({items: [{name: 'Helles', amount: 1}]})],
        event,
      ),
    ).toEqual({
      status: 'not awarded',
    });
  });
});
