import {CardActivity} from '../components/kultcard/CardActivities';
import bird from '@twemoji/svg/1f426.svg';
import camping from '@twemoji/svg/1f3d5.svg';
import pretzel from '@twemoji/svg/1f968.svg';
import bucket from '@twemoji/svg/1faa3.svg';
import plane from '@twemoji/svg/2708.svg';
import moneyBag from '@twemoji/svg/1f4b0.svg';
import broccoli from '@twemoji/svg/1f966.svg';
import signOfHorns from '@twemoji/svg/1f918.svg';
import zap from '@twemoji/svg/26a1.svg';
import jeans from '@twemoji/svg/1f456.svg';
import droplet from '@twemoji/svg/1f4a7.svg';
import cupWithStraw from '@twemoji/svg/1f964.svg';
import beachWithUmbrella from '@twemoji/svg/1f3d6.svg';
import wineGlass from '@twemoji/svg/1f377.svg';
import universalRecyclingSymbol from '@twemoji/svg/267b.svg';
import owl from '@twemoji/svg/1f989.svg';
import fuelPump from '@twemoji/svg/26fd.svg';
import lowBattery from '@twemoji/svg/1faab.svg';
import beerMug from '@twemoji/svg/1f37a.svg';
import zombie from '@twemoji/svg/1f9df.svg';
import candy from '@twemoji/svg/1f36c.svg';
import battery from '@twemoji/svg/1f50b.svg';

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
  availableForCrew: boolean;
  availableForRegular: boolean;
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
  'Probierglas 0.1l Tap',
  'Desperados 0.3',
  'Corona 0.3',
]);

const sugarList = new Set<string>([
  'Spezi',
  'Tüte Süßes',
  'Red Bull',
  'Kuchen',
  'Zimtzucker',
  'Schoko',
  'Schoko-Banane',
  'Waffel'
]);

export type BadgeKey = keyof typeof badgeConfig;

export const badgeConfig = createBadgeDefinitions({
  earlyBird: {
    name: 'Early Bird',
    description: 'Das Kult hat kaum aufgemacht und du bist schon da?',
    bgStart: '#ABDFFF',
    bgEnd: '#3B88C3',
    availableForCrew: true,
    availableForRegular: true,
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
    availableForCrew: true,
    availableForRegular: true,
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
    availableForCrew: true,
    availableForRegular: true,
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
    availableForCrew: false,
    availableForRegular: true,
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
    availableForCrew: true,
    availableForRegular: true,
    emoji: plane,
    compute: (activities) => {
      const wb = new Set(['Kinderbude', 'Wein & Italien', 'EKP']);
      let hasWb = false;
      const rondell = new Set(['Pizza',  'Grill', 'Craft Beer']);
      let hasRondell = false;
      const kb = new Set(['Waffel', 'Empanadas', 'Käsespätzle', 'Wraps', 'Crêpes']);
      let hasKb = false;
      const gb = new Set(['Hot Dog', 'Frittiererei', 'Burger', 'Cocktail']);
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
    availableForCrew: true,
    availableForRegular: true,
    emoji: bucket,
    compute: (activities) => {
      const allProductLists = new Set<string>([
        'Burger',
        'Crêpes',
        'Empanadas',
        'Frittiererei',
        'Grill',
        'Hot Dogs',
        'Käsespätzle',
        'Pizza',
        'Waffeln',
        'Wein & Italien',
        'Weißbiergarten',
        'Wraps',
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
    availableForCrew: true,
    availableForRegular: true,
    emoji: broccoli,
    compute: (activities) => {
      const veggieAlternatives = new Set<string>([
        'Hot Dog (vegetarisch)',
        'Gemüsesemmel',
        'Grillkäsesemmel',
        'Käse-Gemüse-Semmel',
        'Vegetarisch', // Pizza
        'Veggie-Cheeseburger',
        'Veggie-Burger mit Pommes',
        'Vegetarisches Huhn Wrap',
        'Veggie Chilli Cheese Nachos',
        'Veggie Chilli Cheese Fries'

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
  flash: {
    name: 'Flash',
    description: 'Waldbühne zu Große Bühne in unter 3 Minuten',
    bgStart: '#6F62D7',
    bgEnd: '#D201EA',
    availableForCrew: true,
    availableForRegular: false,
    emoji: zap,
    compute: (activities) => {
      const maxSeconds = 3 * 60;
      const gb = [
        'Hot Dogs',
        'Burger',
        'Frittiererei',
        'Ausschank',
        'Cocktail',
      ];
      const wb = ['Wein & Italien', 'Kinderbude'];

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
    availableForCrew: false,
    availableForRegular: true,
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
  hydrationHomie: {
    name: 'Hydration Homie',
    description: 'Expert:innen empfehlen 2,5 Liter Wasser',
    bgStart: '#CEF4FF',
    bgEnd: '#ABE1FF',
    availableForCrew: true,
    availableForRegular: true,
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
    availableForCrew: false,
    availableForRegular: true,
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
  keineTermine: {
    name: 'Keine Termine',
    description: 'Dann kann man auch mal 6 Stunden auf dem Kult verbringen',
    bgStart: '#EEFFC5',
    bgEnd: '#B1EBFF',
    availableForCrew: true,
    availableForRegular: true,
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
    availableForCrew: true,
    availableForRegular: true,
    emoji: wineGlass,
    compute: (activities) => {
      const wineList = new Set([
        'Weinschorle Sauer 0,3l',
        'Weißwein 0,2l',
        'Rosewein 0,2l',
        'Rotwein 0,2l',
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
    description: 'Wenn du weißt was du magst, warum dann was Neues riskieren?',
    bgStart: '#FFF4BE',
    bgEnd: '#F6D600',
    availableForCrew: true,
    availableForRegular: true,
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
  bleifrei: {
    name: 'Bleifrei',
    description: 'Irgendjemand muss ja noch fahren können',
    bgStart: '#F55200',
    bgEnd: '#D92400',
    availableForCrew: true,
    availableForRegular: true,
    emoji: fuelPump,
    compute: (activities) => {
      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.items.some((item) => /alkoholfrei/i.test(item.name))
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
  nachteule: {
    name: 'Nachteule',
    description: 'Ich brauche keinen Schlaf',
    bgStart: '#3B1288',
    bgEnd: '#CEB788',
    availableForCrew: true,
    availableForRegular: false,
    emoji: owl,
    compute: (activities) => {
      for (const activity of activities) {
        if (activity.type === 'order' && activity.time.getUTCHours() < 8) {
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
  uebermuedet: {
    name: 'Übermüdet',
    description: 'Es hilft nur noch Koffein',
    bgStart: '#FFCED7',
    bgEnd: '#D36B72',
    availableForCrew: true,
    availableForRegular: false,
    emoji: lowBattery,
    compute: (activities) => {
      const caffeinatedItems = new Set([
        'Red Bull',
        'Espresso',
        'Cappuccino',
        'Kaffee',
      ]);

      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.items.some((i) => caffeinatedItems.has(i.name))
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
  feierabendbier: {
    name: 'Feierabendbier',
    description: 'Dein erstes Bier des Tages nach 22 Uhr',
    bgStart: '#8C6FD6',
    bgEnd: '#553986',
    availableForCrew: true,
    availableForRegular: true,
    emoji: beerMug,
    compute: (activities) => {
      const seenBeerDays = new Set<string>();

      for (const activity of activities) {
        if (
          activity.type !== 'order' ||
          activity.items.every((i) => !beerList.has(i.name))
        ) {
          continue;
        }

        // Group into event days that start at 06:00, so late-night beers
        // still count towards the previous day's session.
        const sessionStart = sub(activity.time, {hours: 6});
        const dayKey = format(sessionStart, 'yyyy-MM-dd', {
          in: tz('Europe/Berlin'),
        });
        if (seenBeerDays.has(dayKey)) {
          continue;
        }
        seenBeerDays.add(dayKey);

        // 22:00 Europe/Berlin on that session's day.
        const threshold = set(
          sessionStart,
          {hours: 22, minutes: 0, seconds: 0, milliseconds: 0},
          {in: tz('Europe/Berlin')},
        );

        if (
          isEqual(activity.time, threshold) ||
          isAfter(activity.time, threshold)
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
  konterhalbe: {
    name: 'Konterhalbe',
    description: 'Ein Bier am Vormittag – der Kater lässt grüßen',
    bgStart: '#88C057',
    bgEnd: '#3E721D',
    availableForCrew: true,
    availableForRegular: false,
    emoji: zombie,
    compute: (activities) => {
      for (const activity of activities) {
        if (
          activity.type !== 'order' ||
          activity.items.every((i) => !beerList.has(i.name))
        ) {
          continue;
        }

        // Local Europe/Berlin hour of the order (0–23).
        const hour = Number(
          format(activity.time, 'H', {in: tz('Europe/Berlin')}),
        );
        if (hour >= 6 && hour < 12) {
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
  zuckerrausch: {
    name: 'Zuckerrausch',
    description: 'Drei süße Sachen in einer Stunde',
    bgStart: '#FFB4EF',
    bgEnd: '#F4ABBA',
    availableForCrew: true,
    availableForRegular: true,
    emoji: candy,
    compute: (activities) => {
      const target = 3;

      // Every purchased sugar unit, in chronological order (expanded by
      // amount so a single order of 3 counts as 3).
      const sugarTimes: Date[] = [];
      for (const activity of activities) {
        if (activity.type !== 'order') {
          continue;
        }
        for (const item of activity.items) {
          if (sugarList.has(item.name)) {
            for (let i = 0; i < item.amount; i++) {
              sugarTimes.push(activity.time);
            }
          }
        }
      }

      // Sliding 60-minute window over the sugar units.
      let start = 0;
      let maxInWindow = 0;
      for (let end = 0; end < sugarTimes.length; end++) {
        while (differenceInMinutes(sugarTimes[end], sugarTimes[start]) > 60) {
          start++;
        }
        const inWindow = end - start + 1;
        maxInWindow = Math.max(maxInWindow, inWindow);
        if (inWindow >= target) {
          return {
            status: 'awarded',
            awardedAt: sugarTimes[end],
          };
        }
      }

      return {
        status: 'not awarded',
        progress: {
          target,
          current: Math.min(maxInWindow, target),
        },
      };
    },
  },
  erreichbarBleiben: {
    name: 'Erreichbar bleiben',
    description: 'Dein Handy ist geladen',
    bgStart: '#55ACEE',
    bgEnd: '#3B88C3',
    availableForCrew: true,
    availableForRegular: true,
    emoji: battery,
    compute: (activities) => {
      for (const activity of activities) {
        if (
          activity.type === 'order' &&
          activity.items.some((i) => i.name === 'Handy laden')
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
});
