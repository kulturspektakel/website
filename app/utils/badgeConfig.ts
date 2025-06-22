import {CardActivity} from '../components/kultcard/CardActivities';
import bird from '@twemoji/svg/1f426.svg';
import camping from '@twemoji/svg/1f3d5.svg';
import pretzel from '@twemoji/svg/1f968.svg';
import bucket from '@twemoji/svg/1faa3.svg';
import plane from '@twemoji/svg/2708.svg';
import moneyBag from '@twemoji/svg/1f4b0.svg';
import zap from '@twemoji/svg/26a1.svg';
import signOfHorns from '@twemoji/svg/1f918.svg';

import {
  addDays,
  differenceInMinutes,
  differenceInSeconds,
  isAfter,
  isEqual,
  max,
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
      const saturday = addDays(friday, 1).setUTCHours(13);
      const sunday = addDays(friday, 2).setUTCHours(8);
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
    name: 'Lokalpatriot',
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
    name: 'Dauercamper',
    description: 'Mehr als fünf Stunden auf dem Kult und immer noch hier?',
    bgStart: '#C6E5B3',
    bgEnd: '#5C913B',
    crewOnly: false,
    emoji: camping,
    compute: () => {
      // TODO: not implemented yet
      return {status: 'not awarded'};
    },
  },
  richKid: {
    name: 'Rich Kid',
    description:
      'Kult ist nur einmal im Jahr, da kann man auch mal Geld ausgeben',
    bgStart: '#F7DECE',
    bgEnd: '#F4ABBA',
    crewOnly: false,
    emoji: moneyBag,
    compute: () => {
      // TODO: not implemented yet
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
    compute: () => {
      // TODO: not implemented yet
      return {status: 'not awarded'};
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
  kalle: {
    name: 'Kalle',
    description: 'Herrengedeck Kalle spezial',
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
});
