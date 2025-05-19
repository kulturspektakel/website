import {currencyFormatter} from './Card';
import {Box, Flex, Heading, ListItem, ListRoot} from '@chakra-ui/react';
import InfoText from './InfoText';
import {CardTransactionType} from '@prisma/client';

const DEPOSIT_VALUE = 200;

type CardChange = {
  balanceBefore: number;
  balanceAfter: number;
  depositBefore: number;
  depositAfter: number;
  transactionType: CardTransactionType;
};

type MissingTransaction = CardChange & {
  type: 'missing';
  numberOfMissingTransactions: number;
};

type Order = {
  type: 'order';
  productList: string;
  emoji: string | null;
  items: Array<{amount: number; name: string}>;
  cardChange?: CardChange;
  time: Date;
};

type GenericTransaction = CardChange & {
  type: 'generic';
  time: Date;
};

type Badge = {
  type: 'badge';
  time: Date;
  badgeType: 'TEST';
};

export type CardActivity =
  | MissingTransaction
  | Order
  | Badge
  | GenericTransaction;

export function CardActivities({data}: {data?: Array<CardActivity>}) {
  return (
    <ListRoot as="ol" m="0">
      {data?.map((t, i) => <ActivityItem key={i} data={t} />)}
    </ListRoot>
  );
}

function genericTitle(data: CardChange) {
  const depositOnly =
    data.depositAfter !== data.depositBefore &&
    data.balanceAfter - data.balanceBefore ===
      (data.depositBefore - data.depositAfter) * DEPOSIT_VALUE;

  if (depositOnly) {
    return data.depositBefore > data.depositAfter
      ? 'Pfandrückgabe'
      : 'Pfandausgabe';
  }

  if (data.balanceBefore > data.balanceAfter) {
    return 'Abbuchung';
  } else if (data.balanceBefore < data.balanceAfter) {
    return 'Gutschrift';
  } else {
    return 'Unbekannte Buchung';
  }
}

function ActivityItem({data}: {data: CardActivity}) {
  switch (data.type) {
    case 'missing':
      return (
        <Cell
          title={genericTitle(data)}
          description={
            data.numberOfMissingTransactions === 1
              ? 'Details noch nicht verfügbar'
              : `Details von ${data.numberOfMissingTransactions} Buchungen noch nicht verfügbar`
          }
          total={data.balanceAfter - data.balanceBefore}
        />
      );
    case 'generic':
      return (
        <Cell
          title={genericTitle(data)}
          total={data.balanceAfter - data.balanceBefore}
          description={<CellDateTime time={data.time} />}
          accessoryStart={data.balanceAfter > data.balanceBefore ? '💰' : ''}
        />
      );
    case 'order':
      const products = data.items.map((i) => `${i.amount}× ${i.name}`) ?? [];
      const deposit = data.cardChange
        ? data.cardChange.depositAfter - data.cardChange.depositBefore
        : 0;
      if (deposit > 0) {
        products.push(`${deposit}× Pfand`);
      } else if (deposit < 0) {
        products.push(`${deposit * -1}× Pfandrückgabe`);
      }

      return (
        <Cell
          title={data.productList}
          accessoryStart={data.emoji}
          subtitle={products.join(', ')}
          description={<CellDateTime time={data.time} />}
          total={
            data.cardChange
              ? data.cardChange.balanceAfter - data.cardChange.balanceBefore
              : undefined
          }
        />
      );
    case 'badge':
      return null;
  }
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

export function Cell(props: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  accessoryStart?: React.ReactNode;
  total?: number;
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
      <Box flexShrink="0" w="12" px="2" fontSize="xl">
        {props.accessoryStart}
      </Box>
      <Flex direction="column" flexGrow="1">
        <Heading size="md" mb="1">
          {props.title}
        </Heading>
        {props.subtitle && <Box>{props.subtitle}</Box>}
        {props.description && <InfoText>{props.description}</InfoText>}
      </Flex>
      {props.total && (
        <Box fontWeight="bold" ms="3">
          {props.total < 0 ? '+' : ''}
          {currencyFormatter.format(Math.abs(props.total) / 100)}
        </Box>
      )}
    </ListItem>
  );
}
