import {currencyFormatter} from './Card';
import {Box, Flex, Heading, ListItem, ListRoot, Text} from '@chakra-ui/react';
import InfoText from './InfoText';
import {CardTransactionType} from '@prisma/client';
import {FaBan} from 'react-icons/fa6';

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

export type CardActivity = MissingTransaction | Order | GenericTransaction;

export function CardActivities({
  newestToOldest: data,
}: {
  newestToOldest?: Array<CardActivity>;
}) {
  if (data?.length === 0) {
    return (
      <Flex
        direction="column"
        alignItems="center"
        gap="1"
        p="8"
        color="offwhite.500"
      >
        <FaBan />
        Bisher keine Buchungen
      </Flex>
    );
  }
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
          accessoryEnd={
            <CellTotal total={data.balanceAfter - data.balanceBefore} />
          }
        />
      );
    case 'generic':
      return (
        <Cell
          title={genericTitle(data)}
          accessoryEnd={
            <CellTotal total={data.balanceAfter - data.balanceBefore} />
          }
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
          accessoryEnd={
            data.cardChange ? (
              <CellTotal
                total={
                  data.cardChange.balanceAfter - data.cardChange.balanceBefore
                }
              />
            ) : undefined
          }
        />
      );
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

function CellTotal(props: {total: number}) {
  return (
    <Text fontWeight="bold">
      {props.total < 0 ? '+' : ''}
      {currencyFormatter.format(Math.abs(props.total) / 100)}
    </Text>
  );
}

export function Cell(props: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  accessoryStart?: React.ReactNode;
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
      gap="1"
      _last={{
        borderBottomWidth: 0,
        mb: 0,
        pb: 0,
      }}
    >
      <Box flexShrink="0" w="10" fontSize="2xl" textAlign="center">
        {props.accessoryStart}
      </Box>
      <Flex direction="column" flexGrow="1">
        {props.title && (
          <Heading size="md" mb="1">
            {props.title}
          </Heading>
        )}
        {props.subtitle && <Box>{props.subtitle}</Box>}
        {props.description && <InfoText>{props.description}</InfoText>}
      </Flex>
      {props.accessoryEnd && <Box fontWeight="bold">{props.accessoryEnd}</Box>}
    </ListItem>
  );
}
