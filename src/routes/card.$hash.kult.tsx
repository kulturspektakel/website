import {Alert} from '../components/chakra-snippets/alert';
import Card from '../components/kultcard/Card';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {
  queryCardTransactions,
  transformCardAvtivities,
} from '../utils/cardUtils';
import {CardDetails} from '../components/kultcard/CardDetails';
import {decodePayload} from '../utils/decodePayload';

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
      balance,
      deposit,
      cardId,
      hasNewerTransactions:
        transactions.length > 0 && transactions[0].counter! > counter,
    };
  });

export const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const Route = createFileRoute('/card/$hash/kult')({
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

function KultCard() {
  const {balance, deposit, hasNewerTransactions, cardActivities, cardId} =
    Route.useLoaderData();

  return (
    <CardDetails
      infoText="Es kann etwas dauern, bis alle Buchungen vollständig in der Liste dargestellt werden. Das angezeigte Guthaben auf der Karte ist jedoch immer aktuell."
      cardActivities={cardActivities}
      cardId={cardId}
      maxW="450px"
      minH="70dvh"
    >
      {hasNewerTransactions && (
        <Alert title="Neue Buchungen">
          Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
          anzuzeigen.
        </Alert>
      )}
      <Card balance={balance} deposit={deposit} />
    </CardDetails>
  );
}
