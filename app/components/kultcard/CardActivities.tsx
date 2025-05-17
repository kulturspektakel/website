import {currencyFormatter} from './Card';
import {Box, Flex, Heading, ListItem, ListRoot} from '@chakra-ui/react';
import InfoText from './InfoText';

export const DEPOSIT_VALUE = 200;

type CardChange = {
  balanceBefore: number;
  balanceAfter: number;
  depositBefore: number;
  depositAfter: number;
};

type MissingTransaction = CardChange & {
  type: 'missing';
  numberOfMissingTransactions: number;
};

type Order = {
  type: 'order';
  productList: string;
  emoji: string | null;
  items: Array<{amount: number}>;
  cardChange?: CardChange;
  deviceTime: Date;
};

type GenericTransaction = CardChange & {
  type: 'generic';
  deviceTime: Date;
};

type Badge = {
  type: 'badge';
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
          description={<CellDateTime time={data.deviceTime} />}
          accessoryStart={data.balanceAfter > data.balanceBefore ? '💰' : ''}
        />
      );
    case 'order':
      return (
        <Cell
          title={data.productList}
          accessoryStart={data.emoji}
          subtitle={<CellProducts />}
          description={<CellDateTime time={data.deviceTime} />}
        />
      );
    case 'badge':
      return null;
  }
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
      description = '';
      emoji = undefined;
    }
  }
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
      {props.total && (
        <Box fontWeight="bold" ms="3">
          {props.total < 0 ? '+' : ''}
          {currencyFormatter.format(Math.abs(props.total) / 100)}
        </Box>
      )}
    </ListItem>
  );
}
