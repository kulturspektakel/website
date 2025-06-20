import {useMemo} from 'react';
import {CardActivity} from '../components/kultcard/CardActivities';
import {badgeConfig, BadgeDefinition} from './badgeConfig';

export function computeBadges(
  cardActivities: CardActivity[],
  event: {start: Date; end: Date},
  crewOnly: boolean,
) {
  return Object.entries(badgeConfig)
    .filter(([_, v]) => (crewOnly ? true : !v.crewOnly))
    .map(
      ([badgeKey, {compute}]: [keyof typeof badgeConfig, BadgeDefinition]) => ({
        badgeKey,
        ...compute([...cardActivities].reverse(), event),
      }),
    );
}

export function useBadges(
  cardActivities: CardActivity[],
  event: {start: Date; end: Date},
  crewOnly: boolean,
) {
  return useMemo(() => {
    const badgeStatus = computeBadges(cardActivities, event, crewOnly);
    const awardedBadges = badgeStatus.filter((b) => b.status === 'awarded');
    const unawardedBadges = badgeStatus.filter(
      (b) => b.status === 'not awarded',
    );

    return {
      awardedBadges,
      unawardedBadges,
    };
  }, [cardActivities, event]);
}
