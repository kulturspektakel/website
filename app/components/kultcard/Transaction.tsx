import {gql} from 'graphql-request';
import {currencyFormatter} from './Card';
import {CardTransactionFragment} from '../../types/graphql';
import {Box, Flex, Heading, ListItem, ListRoot, Text} from '@chakra-ui/react';
import InfoText from './InfoText';

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

export function Transactions({data}: {data?: Array<CardTransactionFragment>}) {
  return (
    <ListRoot as="ol" m="0">
      {data?.map((t, i) => <Transaction key={i} {...t} />)}
    </ListRoot>
  );
}

function Transaction(props: CardTransactionFragment) {
  const total = props.balanceBefore - props.balanceAfter;
  const isTopUp = props.balanceAfter > props.balanceBefore;

  let title: string = isTopUp ? 'Gutschrift' : 'Abbuchung';
  if (total === 0) {
    title = 'Unbekannte Buchung';
  }
  let subtitle: React.ReactNode = undefined;
  let description: React.ReactNode = undefined;
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
    subtitle = (
      <CellProducts
        items={order?.items}
        deposit={props.depositAfter - props.depositBefore}
      />
    );
    description = <CellDateTime time={props.deviceTime} />;
  } else if (props.__typename === 'MissingTransaction') {
    if (props.numberOfMissingTransactions === 1) {
      description = 'Details noch nicht verfügbar';
    } else {
      description = `Details von ${props.numberOfMissingTransactions} Buchungen noch nicht verfügbar`;
      emoji = undefined;
    }
  }

  return (
    <Cell
      title={title}
      subtitle={subtitle}
      description={description}
      accessoryStart={emoji}
      accessoryEnd={
        <Text fontWeight="bold">
          {total < 0 ? '+' : ''}
          {currencyFormatter.format(Math.abs(total) / 100)}
        </Text>
      }
    />
  );
}

function CellProducts({
  deposit,
  items,
}: {
  deposit?: number;
  items?: Array<{
    amount: number;
    name: string;
  }>;
}) {
  if (!items && !deposit) {
    return null;
  }
  const p = items?.map((i) => `${i.amount}× ${i.name}`) ?? [];

  if (deposit && deposit > 0) {
    p.push(`${deposit}× Pfand`);
  } else if (deposit && deposit < 0) {
    p.push(`${deposit * -1}× Pfandrückgabe`);
  }

  return p.join(', ');
}

function CellDateTime(props: {time: Date}) {
  return (
    <>
      {new Date(props.time)
        .toLocaleDateString('de-DE', {
          weekday: 'short',
          day: '2-digit',
          month: 'long',
          timeZone: 'Europe/Berlin',
        })
        .replace(',', '')}
      ,&nbsp;
      {new Date(props.time).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
      })}
      &nbsp;Uhr
    </>
  );
}

function Cell(props: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  accessoryStart: React.ReactNode;
  accessoryEnd?: React.ReactNode;
}) {
  return (
    <ListItem
      flexDirection="row"
      listStyleType="none"
      display="flex"
      flexDir="row"
      alignItems="center"
      mb="4"
      pb="3"
      borderBottomColor="offwhite.200"
      borderBottomStyle="solid"
      borderBottomWidth={1}
      _last={{
        borderBottomWidth: 0,
        mb: 0,
        pb: 0,
      }}
    >
      <Box flexShrink="0" w="10" ps="1" fontSize="xl">
        {props.accessoryStart}
      </Box>
      <Flex direction="column" flexGrow="1">
        <Heading size="md" mb="1">
          {props.title}
        </Heading>
        {props.subtitle && <Box>{props.subtitle}</Box>}
        {props.description && <InfoText>{props.description}</InfoText>}
      </Flex>
      {props.accessoryEnd && (
        <Box fontWeight="bold" ms="3">
          {props.accessoryEnd}
        </Box>
      )}
    </ListItem>
  );
}
