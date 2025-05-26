import {createFileRoute, Outlet, useLoaderData} from '@tanstack/react-router';
import {badgeConfig} from '../utils/badgeConfig';
import {NewBadge, useNewlyAwardedBadge} from '../components/kultcard/NewBadge';
import {useBadges} from '../utils/useBadges';
import {Heading, ListRoot, VStack} from '@chakra-ui/react';
import {SegmentedControl} from '../components/chakra-snippets/segmented-control';
import {BadgeActivity} from '../components/kultcard/Badges';
import {CardActivities} from '../components/kultcard/CardActivities';
import InfoText from '../components/kultcard/InfoText';
import {useState} from 'react';
import {Highscore} from '../components/kultcard/Highscore';

export const Route = createFileRoute('/card')({
  component: Card,
  validateSearch: (search: {badge?: string}) => {
    if (search.badge && search.badge in badgeConfig) {
      return search as {badge: keyof typeof badgeConfig};
    }
  },
});

const TABS = ['Buchungen', 'Badges'];

function Card() {
  const {cardActivities, event, cardId} = useLoaderData({
    from: '/card/kult/$hash',
  });
  const {highscores} = useLoaderData({
    from: '/card/crew/$hash',
  });
  const {awardedBadges, unawardedBadges} = useBadges(
    cardActivities,
    event,
    false,
  );
  const [active, setActive] = useState(TABS[0]);
  const newlyAwarded = useNewlyAwardedBadge(cardId, awardedBadges);

  return (
    <VStack maxW="450px" mr="auto" ml="auto" align="stretch" minH="70dvh">
      {newlyAwarded && <NewBadge type={newlyAwarded} />}
      <Outlet />
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
        {active === 'Highscores' && (
          <>
            {Object.values(highscores).map((values) => (
              <>
                <Heading textAlign="center" mt="3">
                  {values[0].emoji} {values[0].name}
                </Heading>
                <ListRoot as="ol" m="0">
                  {values.map((value) => (
                    <Highscore
                      key={value.cardId}
                      name={value.displayName ?? value.nickname ?? 'Unbekannt'}
                      place={value.rnk}
                      points={value.amount}
                    />
                  ))}
                </ListRoot>
              </>
            ))}
          </>
        )}
        <InfoText textAlign="center">
          Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
          dargestellt werden. Das angezeigte Guthaben auf der Karte ist jedoch
          immer aktuell.
        </InfoText>
        <InfoText textAlign="center">
          Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
          dargestellt werden.
        </InfoText>
      </VStack>
    </VStack>
  );
}
