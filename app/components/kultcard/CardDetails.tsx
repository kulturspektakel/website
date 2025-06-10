import {useMemo, useState} from 'react';
import {NewBadge} from './NewBadge';
import {ClientOnly, StackProps, VStack} from '@chakra-ui/react';
import {SegmentedControl} from '../chakra-snippets/segmented-control';
import {BadgeActivity} from './Badges';
import {CardActivities, CardActivity} from './CardActivities';
import {Highscore, HighscoreProps} from './Highscore';
import InfoText from './InfoText';
import {useBadges} from '../../utils/useBadges';
import {useRouteContext} from '@tanstack/react-router';

export function CardDetails({
  infoText,
  children,
  cardActivities,
  highscores,
  cardId,
  ...stackProps
}: {
  cardId: string;
  infoText: string;
  children: React.ReactNode;
  cardActivities: Array<CardActivity>;
  highscores?: HighscoreProps;
} & StackProps) {
  const {event} = useRouteContext({
    from: '/card/$hash',
  });
  const TABS = useMemo(() => {
    const t = ['Buchungen', 'Badges'];
    if (highscores) {
      t.push('Highscores');
    }
    return t;
  }, [highscores]);
  const [active, setActive] = useState(TABS[0]);
  const {awardedBadges, unawardedBadges} = useBadges(
    cardActivities,
    event,
    true,
  );
  return (
    <VStack mr="auto" ml="auto" align="stretch" {...stackProps}>
      <ClientOnly>
        <NewBadge cardId={cardId} awarded={awardedBadges} />
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
          <CardActivities newestToOldest={cardActivities} />
        )}
        {active === 'Badges' && (
          <BadgeActivity
            awardedBadges={awardedBadges}
            unawardedBadges={unawardedBadges}
          />
        )}
        {highscores && active === 'Highscores' && (
          <Highscore data={highscores} />
        )}
        <InfoText textAlign="center">{infoText}</InfoText>
      </VStack>
    </VStack>
  );
}
