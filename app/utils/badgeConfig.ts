import {CardActivity} from '../components/kultcard/CardActivities';
import bird from '@twemoji/svg/1f426.svg';
import camping from '@twemoji/svg/1f3d5.svg';
import pretzel from '@twemoji/svg/1f968.svg';
import bucket from '@twemoji/svg/1faa3.svg';
import plane from '@twemoji/svg/2708.svg';
import moneyBag from '@twemoji/svg/1f4b0.svg';
import broccoli from '@twemoji/svg/1f966.svg';
import signOfHorns from '@twemoji/svg/1f918.svg';
import tropicalDrink from '@twemoji/svg/1f379.svg';
import zap from '@twemoji/svg/26a1.svg';
import jeans from '@twemoji/svg/1f456.svg';
import droplet from '@twemoji/svg/1f4a7.svg';
import cupWithStraw from '@twemoji/svg/1f964.svg';
import fox from '@twemoji/svg/1f98a.svg';
import beachWithUmbrella from '@twemoji/svg/1f3d6.svg';
import wineGlass from '@twemoji/svg/1f377.svg';
import universalRecyclingSymbol from '@twemoji/svg/267b.svg';

import {tz} from '@date-fns/tz';

import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  differenceInSeconds,
  format,
  isAfter,
  isEqual,
  isSameDay,
  max,
  set,
  sub,
} from 'date-fns';

export type BadgeStatus =
  | {
      awardedAt: Date;
      status: 'awarded';
    }
  | {
      status: 'not awarded';
      progress?: {
        current: number;
        target: number;
      };
    };

export type BadgeDefinition = {
  name: string;
  description: string;
  bgStart: string;
  bgEnd: string;
  crewOnly: boolean;
  emoji: string;
  compute: (
    cardActivities: Array<CardActivity>,
    event: {start: Date; end: Date},
  ) => BadgeStatus;
};

function createBadgeDefinitions<K extends string>(obj: {
  [P in K]: BadgeDefinition;
}): {[P in K]: BadgeDefinition} {
  return obj;
}

const beerList = new Set([
  'Weißbier',
  'Weißbier alkoholfrei',
  'Russ',
  'Helles',
  'Radler',
  'Helles alkoholfrei',
  'Bottle 0.5',
  'Bottle 0.3',
  'Tap 0.5',
  'Tap 0.3',
  'Tastingbrett',
  'Desperados 0.3',
  'Corona 0.3',
]);

export const badgeConfig = createBadgeDefinitions({
  earlyBird: {
    name: 'Early Bird',
    description: 'Das Kult hat kaum aufgemacht und du bist schon da?',
    bgStart: '#ABDFFF',
    bgEnd: '#3B88C3',
    crewOnly: false,
    emoji: bird,
    compute: (activities, event) => {
      const friday = event.start;
      const saturday = set(
        addDays(friday, 1),
        {
          hours: 15,
          minutes: 0,
          seconds: 0,
        },
        {
          in: tz('Europe/Berlin'),
        },
      );
      const sunday = set(
        addDays(friday, 2),
        {
          hours: 10,
          minutes: 0,
          seconds: 0,
        },
        {
          in: tz('Europe/Berlin'),
        },
      );
      const startOfDays = [friday, saturday, sunday];

      for (const activity of activities) {
        if (activity.type !== 'order' && activity.type !== 'generic') {
          continue;
        }
        for (const startOfDay of startOfDays) {
          if (
            (isEqual(activity.time, startOfDay) ||
              isAfter(activity.time, startOfDay)) &&
            differenceInMinutes(activity.time, startOfDay) < 60
          ) {
            return {status: 'awarded', awardedAt: activity.time};
          }
        }
      }

      return {status: 'not awarded'};
    },
  },
  lokalPatriot: {
    name: 'Lokalpatriot:in',
    description: 'Frühschoppen und Weißbiergarten sind deine Heimat',
    bgStart: '#AA8DD8',
    bgEnd: '#7450A8',
    crewOnly: false,
    emoji: pretzel,
    compute: (activity) => {
      const fruehshoppen = activity.find(
        (a) => a.type === 'order' && a.productList === 'Frühschoppen',
      );
      const weissbier = activity.find(
        (a) =>
          a.type === 'order' &&
          (a.productList === 'Weißbiergarten' ||
            a.productList === 'Weißbierbar'),
      );

      if (fruehshoppen?.type === 'order' && weissbier?.type === 'order') {
        return {
          status: 'awarded',
          awardedAt: max([fruehshoppen.time, weissbier.time]),
        };
      }

      return {
        status: 'not awarded',
        progress: {
          target: 2,
          current: fruehshoppen || weissbier ? 1 : 0,
        },
      };
    },
  },
  dauercamper: {
    name: 'Dauercamper:in',
    description: 'Du bist jeden Tag auf dem Kult',
    bgStart: '#C6E5B3',
    bgEnd: '#5C913B',
    crewOnly: false,
    emoji: camping,
    compute: (activities, event) => {
      const noEventDays =
        differenceInCalendarDays(event.end, event.start, {
          in: tz('Europe/Berlin'),
        }) + 1;
      const activityDays = new Set<string>();
      for (const activity of activities) {
        if (activity.type === 'missing') {
          continue;
        }
        activityDays.add(
          format(sub(activity.time, {hours: 6}), 'yyyy-MM-dd', {
            in: tz('Europe/Berlin'),
          }),
        );
        if (activityDays.size === noEventDays) {
          return {
            status: 'awarded',
            awardedAt: activity.time,
          };
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target: noEventDays,
          current: activityDays.size,
        },
      };
    },
  },
  investor: {
    name: 'Investor:in',
    description: 'Du hast 50 Euro (oder mehr) auf deine Karte aufgeladen',
    bgStart: '#F7DECE',
    bgEnd: '#F4ABBA',
    crewOnly: false,
    emoji: moneyBag,
    compute: (activities) => {
      for (const activity of activities) {
        if (
          activity.type === 'generic' &&
          activity.transactionType === 'TopUp' &&
          activity.balanceAfter >= 5000
        ) {
          return {
            status: 'awarded',
            awardedAt: activity.time,
          };
        }
      }

      return {status: 'not awarded'};
    },
  },
  globetrotter: {
    name: 'Globetrotter',
    description:
      'Große Bühne, Kultbühne, Rondell und Waldbühne heute. New York, Rio und Hong Kong morgen',
    bgStart: '#C6E5B3',
    bgEnd: '#5C913B',
    crewOnly: false,
    emoji: plane,
    compute: (activities) => {
      const wb = new Set(['Kinderbude', 'Italien', 'EKP']);
      let hasWb = false;
      const rondell = new Set(['Pizza', 'Frittiererei', 'Grill', 'Craft Beer']);
      let hasRondell = false;
      const kb = new Set(['Waffel', 'Empanadas']);
      let hasKb = false;
      const gb = new Set(['Hot Dog', 'Schokofrüchte', 'Cocktail']);
      let hasGb = false;

      for (const activity of activities) {
        if (activity.type !== 'order') {
          continue;
        }

        hasWb = hasWb || wb.has(activity.productList);
        hasRondell = hasRondell || rondell.has(activity.productList);
        hasKb = hasKb || kb.has(activity.productList);
        hasGb = hasGb || gb.has(activity.productList);

        if (hasWb && hasRondell && hasKb && hasGb) {
          return {
            status: 'awarded',
            awardedAt: activity.time,
          };
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target: 4,
          current:
            Number(hasWb) + Number(hasRondell) + Number(hasKb) + Number(hasGb),
        },
      };
    },
  },
  bucketlist: {
    name: 'Bucketlist',
    description: 'Keine Essensbude, die du nicht besucht hast',
    bgStart: '#FFE8B6',
    bgEnd: '#FFCC4D',
    crewOnly: false,
    emoji: bucket,
    compute: (activities) => {
      const allProductLists = new Set<string>([
        'Weißbiergarten',
        'Hot Dog',
        'Italien',
        'Waffel',
        'Frittiererei',
        'Pizza',
        'Grill',
        'Empanadas',
        'Schokofrüchte',
      ]);
      const allListsLength = allProductLists.size;

      for (const activity of activities) {
        if (allProductLists.size === 0) {
          break;
        }
        if (activity.type !== 'order') {
          continue;
        }
        if (allProductLists.has(activity.productList)) {
          allProductLists.delete(activity.productList);

          if (allProductLists.size === 0) {
            return {
              status: 'awarded',
              awardedAt: activity.time,
            };
          }
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target: allListsLength,
          current: allListsLength - allProductLists.size,
        },
      };
    },
  },
  tierfreundin: {
    name: 'Tierfreund:in',
    description: 'Du hast die vegetarische Alternative gewählt',
    bgStart: '#34C9FF',
    bgEnd: '#64E43D',
    crewOnly: false,
    emoji: broccoli,
    compute: (activities) => {
      const veggieAlternatives = new Set<string>([
        'Hot Dog (vegetarisch)',
        'Gemüsesemmel',
        'Grillkäsesemmel',
        'Käse-Gemüse-Semmel',
        'Vegetarisch', // Pizza
        'Waffel Vegan',
      ]);
      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.items.some((item) => veggieAlternatives.has(item.name))
        ) {
          return {
            status: 'awarded',
            awardedAt: activity.time,
          };
        }
      }

      return {
        status: 'not awarded',
      };
    },
  },
  kalle: {
    name: 'Kalle',
    description: 'Herrengedeck nach Kalle Art',
    bgStart: '#6b6b6b',
    bgEnd: '#090909',
    crewOnly: true,
    emoji: signOfHorns,
    compute: (activities) => {
      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.items.some((i) => i.name === 'Vodka Bull')
        ) {
          for (const activity2 of activities) {
            if (
              activity2.type === 'order' &&
              activity2.items.some((i) => i.name === 'Weißbier') &&
              Math.abs(differenceInMinutes(activity.time, activity2.time)) <= 60
            ) {
              return {
                status: 'awarded',
                awardedAt: max([activity.time, activity2.time]),
              };
            }
          }
        }
      }
      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.items.some(
            (i) => i.name === 'Weißbier' || i.name === 'Vodka Bull',
          ) &&
          differenceInMinutes(new Date(), activity.time) < 60
        ) {
          return {
            status: 'not awarded',
            progress: {
              target: 2,
              current: 1,
            },
          };
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target: 2,
          current: 0,
        },
      };
    },
  },
  flash: {
    name: 'Flash',
    description: 'Waldbühne zu Große Bühne in unter 5 Minuten',
    bgStart: '#6F62D7',
    bgEnd: '#D201EA',
    crewOnly: true,
    emoji: zap,
    compute: (activities) => {
      const maxSeconds = 5 * 60;
      const gb = ['Hot Dog', 'Cocktail', 'Schokofrüchte'];
      const wb = ['Italien', 'Kinder'];

      let hasOne = false;

      for (const activity of activities) {
        if (activity.type === 'order' && wb.includes(activity.productList)) {
          for (const activity2 of activities) {
            if (
              activity2.type === 'order' &&
              Math.abs(differenceInSeconds(activity2.time, activity.time)) <=
                maxSeconds &&
              gb.includes(activity2.productList)
            ) {
              return {
                status: 'awarded',
                awardedAt: max([activity.time, activity2.time]),
              };
            }
          }

          if (differenceInSeconds(new Date(), activity.time) <= maxSeconds) {
            hasOne = true;
          }
        }
      }

      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          differenceInSeconds(new Date(), activity.time) <= maxSeconds &&
          gb.includes(activity.productList)
        ) {
          hasOne = true;
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target: 2,
          current: hasOne ? 1 : 0,
        },
      };
    },
  },
  spendierhosen: {
    name: 'Spendierhosen',
    description: 'Eine Runde Bier für dich und mindestens zwei Freunde',
    bgStart: '#F7DECE',
    bgEnd: '#F4ABBA',
    crewOnly: false,
    emoji: jeans,
    compute: (activities) => {
      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.items.reduce((acc, item) => {
            return acc + (beerList.has(item.name) ? item.amount : 0);
          }, 0) >= 3
        ) {
          return {
            status: 'awarded',
            awardedAt: activity.time,
          };
        }
      }
      return {
        status: 'not awarded',
      };
    },
  },
  rothy: {
    name: 'Rothy',
    description: 'Muss man sich den Rothy hier wirklich selbst mischen?',
    bgStart: '#FF3437',
    bgEnd: '#FFAE00',
    crewOnly: true,
    emoji: tropicalDrink,
    compute: (activities) => {
      for (const activity of activities) {
        if (activity.type === 'order' && activity.productList === 'Ausschank') {
          let hasLimo = false;
          let hasSpezi = false;
          let hasHelles = false;
          for (const item of activity.items) {
            if (item.name === 'Helles') {
              hasHelles = true;
            } else if (item.name === 'Spezi') {
              hasSpezi = true;
            } else if (item.name === 'Limo') {
              hasLimo = true;
            }

            if (hasLimo && hasSpezi && hasHelles) {
              return {
                status: 'awarded',
                awardedAt: activity.time,
              };
            }
          }
        }
      }

      return {
        status: 'not awarded',
      };
    },
  },
  hydrationHomie: {
    name: 'Hydration Homie',
    description: 'Expert:innen empfehlen 2,5 Liter Wasser',
    bgStart: '#CEF4FF',
    bgEnd: '#ABE1FF',
    crewOnly: false,
    emoji: droplet,
    compute: (activities) => {
      const target = 5;
      let count = 0;
      for (const activity of activities) {
        if (activity.type === 'order') {
          count += activity.items.reduce(
            (acc, item) => acc + (item.name === 'Wasser' ? item.amount : 0),
            0,
          );
          if (count >= target) {
            return {
              status: 'awarded',
              awardedAt: activity.time,
            };
          }
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target,
          current: count,
        },
      };
    },
  },
  pfandsammlerin: {
    name: 'Pfandsammler:in',
    description: 'Mehr als 4 Becher? Ist das deine Altersvorsorge?',
    bgStart: '#9FACFF',
    bgEnd: '#6500C9',
    crewOnly: false,
    emoji: cupWithStraw,
    compute: (activities) => {
      const target = 5;
      for (const activity of activities) {
        if (
          (activity.type === 'generic' && activity.depositAfter >= target) ||
          (activity.type === 'order' &&
            (activity.cardChange?.depositAfter ?? 0) >= target)
        ) {
          return {
            status: 'awarded',
            awardedAt: activity.time,
          };
        }
      }

      return {
        status: 'not awarded',
      };
    },
  },
  sparfuchs: {
    name: 'Sparfuchs',
    description: 'Radler selbst gemischt und 50 Cent gespart',
    bgStart: '#FFF9C5',
    bgEnd: '#FFE9B1',
    crewOnly: false,
    emoji: fox,
    compute: (activities) => {
      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.productList === 'Ausschank' &&
          activity.items.some((i) => i.name === 'Helles') &&
          activity.items.some((i) => i.name === 'Limo') &&
          activity.items.every((i) => i.name !== 'Radler')
        ) {
          return {
            status: 'awarded',
            awardedAt: activity.time,
          };
        }
      }

      return {
        status: 'not awarded',
      };
    },
  },
  keineTermine: {
    name: 'Keine Termine',
    description: 'Dann kann man auch mal 6 Stunden auf dem Kult verbringen',
    bgStart: '#EEFFC5',
    bgEnd: '#B1EBFF',
    crewOnly: true,
    emoji: beachWithUmbrella,
    compute: (activities) => {
      const targetMinutes = 6 * 60;
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];

        if (activity.type === 'missing') {
          continue;
        }

        for (let j = i + 1; j < activities.length; j++) {
          const activity2 = activities[j];

          if (activity2.type === 'missing') {
            continue;
          }
          if (
            differenceInMinutes(activity2.time, activity.time) > targetMinutes
          ) {
            if (
              isSameDay(
                sub(activity2.time, {hours: 6}),
                sub(activity.time, {hours: 6}),
                {
                  in: tz('Europe/Berlin'),
                },
              )
            ) {
              return {
                status: 'awarded',
                awardedAt: activity2.time,
              };
            }
            break;
          }
        }
      }

      return {
        status: 'not awarded',
      };
    },
  },
  weinAufBier: {
    name: 'Wein auf Bier',
    description: "…das rat' ich dir",
    bgStart: '#FFB4EF',
    bgEnd: '#71007B',
    crewOnly: true,
    emoji: wineGlass,
    compute: (activities) => {
      const wineList = new Set([
        'Weinschorle Sauer 0,5l',
        'Weißwein 0,2l',
        'Rosewein 0,2l',
        'Rotwein 0,2l',
        'Lugana',
      ]);

      let activity1: CardActivity | undefined;
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];

        if (
          activity.type !== 'order' ||
          activity.items.every((i) => !beerList.has(i.name))
        ) {
          continue;
        }

        activity1 = activity;

        for (let j = i + 1; j < activities.length; j++) {
          const activity2 = activities[j];
          if (
            activity2.type === 'order' &&
            activity2.items.some((i) => wineList.has(i.name)) &&
            isSameDay(
              sub(activity2.time, {hours: 6}),
              sub(activity.time, {hours: 6}),
              {
                in: tz('Europe/Berlin'),
              },
            )
          ) {
            return {
              status: 'awarded',
              awardedAt: activity2.time,
            };
          }
        }
      }

      return {
        status: 'not awarded',
        progress:
          activity1?.type === 'order' &&
          isSameDay(activity1.time, sub(new Date(), {hours: 6}), {
            in: tz('Europe/Berlin'),
          })
            ? {
                target: 2,
                current: 1,
              }
            : undefined,
      };
    },
  },
  wieImmer: {
    name: 'Wie immer?',
    description: 'Wenn du weißt was du magst, warum dann was Neues probieren?',
    bgStart: '#FFF4BE',
    bgEnd: '#F6D600',
    crewOnly: true,
    emoji: universalRecyclingSymbol,
    compute: (activities) => {
      const orders = new Map<string, number>();
      let max = 0;
      const target = 3;
      for (const activity of activities) {
        if (activity.type === 'order') {
          const order =
            activity.productList +
            activity.items
              .sort((a, b) => (a.name > b.name ? 1 : -1))
              .map((item) => item.name)
              .join('#');

          const count = (orders.get(order) ?? 0) + 1;
          if (count === target) {
            return {
              status: 'awarded',
              awardedAt: activity.time,
            };
          }
          orders.set(order, count);
          max = Math.max(max, count);
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target,
          current: max,
        },
      };
    },
  },
});
