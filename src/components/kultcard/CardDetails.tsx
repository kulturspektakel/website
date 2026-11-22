import {useMemo, useState} from 'react';
import {NewBadge} from './NewBadge';
import {ClientOnly, StackProps, VStack} from '@chakra-ui/react';
import {SegmentedControl} from '../chakra-snippets/segmented-control';
import {BadgeActivity} from './Badges';
import {
  CardActivities,
  type CardActivity,
  type NotForMeOwner,
} from './CardActivities';
import InfoText from './InfoText';
import {useBadges} from '../../utils/useBadges';
import type {BadgeKey} from '../../utils/badgeConfig';
import {useLoaderData} from '@tanstack/react-router';

export function CardDetails({
  infoText,
  children,
  cardActivities,
  cardId,
  cardType,
  notForMeOwner,
  linkedBadge,
  footer,
  ...stackProps
}: {
  /** Where the badges seen last time are remembered (`badges:<cardId>`). */
  cardId: string;
  infoText: string;
  children: React.ReactNode;
  cardActivities: Array<CardActivity>;
  cardType: 'crew' | 'regular';
  /** CrewCards: whose orders can be marked "nicht für mich". */
  notForMeOwner?: NotForMeOwner;
  /** The badge from the page's `?badge=`. */
  linkedBadge: BadgeKey | undefined;
  footer?: React.ReactNode;
} & StackProps) {
  const {event} = useLoaderData({from: '/_main'});
  const TABS = useMemo(() => ['Buchungen', 'Badges'], []);
  const [active, setActive] = useState(TABS[0]);
  const {awardedBadges, unawardedBadges} = useBadges(
    cardActivities,
    event,
    cardType === 'crew',
  );
  return (
    <VStack mr="auto" ml="auto" align="stretch" {...stackProps}>
      <ClientOnly>
        <NewBadge
          cardId={cardId}
          awarded={awardedBadges}
          linkedBadge={linkedBadge}
        />
      </ClientOnly>
      {children}
      <SegmentedControl
        mt="5"
        value={active}
        onValueChange={({value}) => setActive(value!)}
        items={TABS.map((t) => ({value: t, label: t}))}
      />
      <VStack gap="5" align="stretch" mt="3">
        {active === 'Buchungen' && (
          <CardActivities
            newestToOldest={cardActivities}
            notForMeOwner={notForMeOwner}
          />
        )}
        {active === 'Badges' && (
          <BadgeActivity
            awardedBadges={awardedBadges}
            unawardedBadges={unawardedBadges}
          />
        )}
        <InfoText textAlign="center">{infoText}</InfoText>
      </VStack>
      {footer}
    </VStack>
  );
}
