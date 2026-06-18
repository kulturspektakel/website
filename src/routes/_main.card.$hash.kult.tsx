import {Alert} from '../components/chakra-snippets/alert';
import Card from '../components/kultcard/Card';
import {createFileRoute} from '@tanstack/react-router';
import {seo} from '../utils/seo';
import {CardDetails} from '../components/kultcard/CardDetails';
import {createServerFn} from '@tanstack/react-start';
import {queryCardTransactions} from '../server/cardUtils.server';
import {
  hasNewerTransactions,
  transformCardAvtivities,
} from '../utils/cardUtils';
import {decodePayload} from '../utils/decodePayload';

const loader = createServerFn()
  .inputValidator(
    (data: {hash: string; event: {start: Date; end: Date}}) => data,
  )
  .handler(async ({data: {event, hash}}) => {
    const {cardId, counter, balance, deposit} = decodePayload('kultcard', hash);

    const transactions = await queryCardTransactions(cardId, event);

    // Compute this before transformCardAvtivities, which mutates `transactions`
    // in place and splices off exactly the entries newer than `counter`.
    const newerTransactions = hasNewerTransactions(transactions, counter);

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
      hasNewerTransactions: newerTransactions,
    };
  });

export const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const Route = createFileRoute('/_main/card/$hash/kult')({
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
      cardType="regular"
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
