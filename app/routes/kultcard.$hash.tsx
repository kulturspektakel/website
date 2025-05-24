import {VStack} from '@chakra-ui/react';
import {Alert} from '../components/chakra-snippets/alert';
import Card from '../components/kultcard/Card';
import InfoText from '../components/kultcard/InfoText';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {CardActivities} from '../components/kultcard/CardActivities';
import {SegmentedControl} from '../components/chakra-snippets/segmented-control';
import {useState} from 'react';
import {BadgeActivity} from '../components/kultcard/Badges';
import {useBadges} from '../utils/useBadges';
import {
  decodePayload,
  queryCardTransactions,
  transformCardAvtivities,
} from '../utils/cardUtils';

const loader = createServerFn()
  .validator((data: {hash: string; event: {start: Date; end: Date}}) => data)
  .handler(async ({data: {event, hash}}) => {
    const {cardId, counter, balance, deposit} = decodePayload('kultcard', hash);

    const transactions = await queryCardTransactions(cardId, event);

    const cardActivities = transformCardAvtivities(
      transactions,
      counter,
      balance,
      deposit,
    );
    return {
      cardActivities,
      event,
      balance,
      deposit,
      hasNewerTransactions:
        transactions.length > 0 && transactions[0].counter! > counter,
    };
  });

export const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const Route = createFileRoute('/kultcard/$hash')({
  component: KultCard,
  loader: async ({params: {hash}, context: {event}}) =>
    await loader({data: {hash, event}}),
  head: ({loaderData}) =>
    loaderData
      ? seo({
          title: `KultCard Guthaben ${currencyFormatter.format(loaderData.balance / 100)}`,
        })
      : {},
});

const TABS = ['Buchungen', 'Badges'];

function KultCard() {
  const {balance, deposit, cardActivities, event, hasNewerTransactions} =
    Route.useLoaderData();
  const [active, setActive] = useState(TABS[0]);
  const {awardedBadges, unawardedBadges} = useBadges(
    cardActivities,
    event,
    false,
  );

  return (
    <VStack maxW="450px" mr="auto" ml="auto" align="stretch" minH="70dvh">
      {hasNewerTransactions && (
        <Alert title="Neue Buchungen">
          Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
          anzuzeigen.
        </Alert>
      )}
      <Card balance={balance} deposit={deposit} />

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
        <InfoText textAlign="center">
          Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
          dargestellt werden. Das angezeigte Guthaben auf der Karte ist jedoch
          immer aktuell.
        </InfoText>
      </VStack>
    </VStack>
  );
}
