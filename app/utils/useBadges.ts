import {useMemo} from 'react';
import {CardActivity} from '../components/kultcard/CardActivities';
import {badgeConfig, BadgeDefinition} from './badgeConfig';

export function computeBadges(
  cardActivities: CardActivity[],
  event: {start: Date; end: Date},
  isCrew: boolean,
) {
  return Object.entries(badgeConfig)
    .filter(([_, v]) => (isCrew ? v.availableForCrew : v.availableForRegular))
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
  isCrew: boolean,
) {
  return useMemo(() => {
    const badgeStatus = computeBadges(cardActivities, event, isCrew);
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
