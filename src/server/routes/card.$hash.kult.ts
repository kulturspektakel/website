import {createServerFn} from '@tanstack/react-start';
import {queryCardTransactions} from '../../utils/cardUtils.server';
import {transformCardAvtivities} from '../../utils/cardUtils';
import {decodePayload} from '../../utils/decodePayload';

export const loader = createServerFn()
  .inputValidator(
    (data: {hash: string; event: {start: Date; end: Date}}) => data,
  )
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
