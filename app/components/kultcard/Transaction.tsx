import {gql} from 'graphql-request';
import {currencyFormatter} from './Card';
import {CardTransactionFragment} from '~/types/graphql';
import {Box, Flex, Heading, ListItem} from '@chakra-ui/react';

export const CardTransaction = gql`
  fragment CardTransaction on Transaction {
    depositBefore
    depositAfter
    balanceBefore
    balanceAfter
    __typename

    ... on CardTransaction {
      deviceTime
      Order {
        items {
          amount
          name
          productList {
            emoji
            name
          }
        }
      }
    }
    ... on MissingTransaction {
      numberOfMissingTransactions
    }
  }
`;

export default function Transaction(props: CardTransactionFragment) {
  const total = props.balanceBefore - props.balanceAfter;
  const isTopUp = props.balanceAfter > props.balanceBefore;

  let title: string = isTopUp ? 'Gutschrift' : 'Abbuchung';
  if (total === 0) {
    title = 'Unbekannte Buchung';
  }
  let subtitle: string | undefined = undefined;
  let emoji: string | undefined = isTopUp ? '💰' : undefined;

  if (props.__typename === 'CardTransaction') {
    const order = props.Order;
    const productList = order?.items.find(() => true)?.productList;
    if (productList?.emoji) {
      emoji = productList.emoji;
    }
    if (productList?.name) {
      title = productList?.name;
    }

    const p = order?.items.map((i) => `${i.amount}× ${i.name}`) ?? [];
    const deposit = props.depositAfter - props.depositBefore;
    if (deposit > 0) {
      p.push(`${deposit}× Pfand`);
    } else if (deposit < 0) {
      p.push(`${deposit * -1}× Pfandrückgabe`);
    }
    subtitle = p.join(', ');
  } else if (props.__typename === 'MissingTransaction') {
    if (props.numberOfMissingTransactions === 1) {
      subtitle = 'Details noch nicht verfügbar';
    } else {
      subtitle = `Details von ${props.numberOfMissingTransactions} Buchungen noch nicht verfügbar`;
      emoji = undefined;
    }
  }

  return (
    <ListItem flexDirection="row">
      <Box>{emoji}</Box>
      <Flex direction="column" flex="1">
        <Heading>{title}</Heading>
        {props.__typename === 'CardTransaction' ? (
          <Box whiteSpace="nowrap" textOverflow="ellipsis" overflow="hidden">
            {subtitle}
            <br />
            <>
              {new Date(props.deviceTime)
                .toLocaleDateString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'long',
                  timeZone: 'Europe/Berlin',
                })
                .replace(',', '')}
              ,&nbsp;
              {new Date(props.deviceTime).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Berlin',
              })}
              &nbsp;Uhr
            </>
          </Box>
        ) : (
          <Box>{subtitle}</Box>
        )}
      </Flex>
      {total !== 0 && (
        <Box>
          {total < 0 ? '+' : ''}
          {currencyFormatter.format(Math.abs(total) / 100)}
        </Box>
      )}
    </ListItem>
  );
}
