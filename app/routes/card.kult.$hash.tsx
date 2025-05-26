import {Alert} from '../components/chakra-snippets/alert';
import Card from '../components/kultcard/Card';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
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
      cardId,
      hasNewerTransactions:
        transactions.length > 0 && transactions[0].counter! > counter,
    };
  });

export const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export const Route = createFileRoute('/card/kult/$hash')({
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
  const {balance, deposit, hasNewerTransactions} = Route.useLoaderData();

  return (
    <>
      {hasNewerTransactions && (
        <Alert title="Neue Buchungen">
          Es liegen neuere Buchungen vor. Karte erneut auslesen um diese
          anzuzeigen.
        </Alert>
      )}
      <Card balance={balance} deposit={deposit} />
    </>
  );
}
