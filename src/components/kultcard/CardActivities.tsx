import {currencyFormatter} from './Card';
import {
  Badge,
  Box,
  Flex,
  Heading,
  IconButton,
  ListItem,
  ListRoot,
  Text,
} from '@chakra-ui/react';
import InfoText from './InfoText';
import {CardTransactionType} from '../../generated/prisma/browser';
import {FaBan, FaXmark} from 'react-icons/fa6';
import {useState} from 'react';
import {useRouter} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {prismaClient} from '../../server/prismaClient.server';
import {stringToByteArray} from '../../utils/cardUtils';

const DEPOSIT_VALUE = 200;

const setOrderNotForMe = createServerFn({method: 'POST'})
  .inputValidator(
    z.object({
      cardId: z.string(),
      orderId: z.number().int(),
      notForMe: z.boolean(),
    }),
  )
  .handler(async ({data: {cardId, orderId, notForMe}}) => {
    await prismaClient.order.updateMany({
      where: {id: orderId, crewCardId: stringToByteArray(cardId)},
      data: {notForMe},
    });
  });

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
  orderId?: number;
  notForMe?: boolean | null;
  productList: string;
  emoji: string | null;
  items: Array<{amount: number; name: string}>;
  cardChange?: CardChange;
  time: Date;
};

type GenericTransaction = CardChange & {
  type: 'generic';
  time: Date;
  transactionType: CardTransactionType;
};

export type CardActivity = MissingTransaction | Order | GenericTransaction;

export function CardActivities({
  newestToOldest: data,
  crewCardId,
}: {
  newestToOldest?: Array<CardActivity>;
  crewCardId?: string;
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
      {data?.map((t, i) => (
        <ActivityItem key={i} data={t} crewCardId={crewCardId} />
      ))}
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

function ActivityItem({
  data,
  crewCardId,
}: {
  data: CardActivity;
  crewCardId?: string;
}) {
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
          subtitle={
            <Flex align="center" gap="2" display="inline-flex">
              {data.notForMe && crewCardId && data.orderId != null && (
                <NotForMeBadge cardId={crewCardId} orderId={data.orderId} />
              )}
              {products.join(', ')}
            </Flex>
          }
          description={<CellDateTime time={data.time} />}
          accessoryEnd={
            !data.notForMe && crewCardId && data.orderId != null ? (
              <NotForMeButton cardId={crewCardId} orderId={data.orderId} />
            ) : data.cardChange ? (
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

function NotForMeBadge({cardId, orderId}: {cardId: string; orderId: number}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Badge colorPalette="red" gap="1">
      Nicht für mich
      <Box
        as="button"
        display="inline-flex"
        alignItems="center"
        cursor="pointer"
        aria-label="Markierung entfernen"
        onClick={async () => {
          if (pending) {
            return;
          }
          setPending(true);
          try {
            await setOrderNotForMe({data: {cardId, orderId, notForMe: false}});
            await router.invalidate();
          } finally {
            setPending(false);
          }
        }}
      >
        <FaXmark />
      </Box>
    </Badge>
  );
}

function NotForMeButton({cardId, orderId}: {cardId: string; orderId: number}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <IconButton
      size="xs"
      variant="outline"
      aria-label="Als „nicht für mich“ markieren"
      loading={pending}
      onClick={async () => {
        if (
          !window.confirm(
            'Diese Buchung als „nicht für mich“ markieren? Sie zählt dann nicht für Badges.',
          )
        ) {
          return;
        }
        setPending(true);
        try {
          await setOrderNotForMe({data: {cardId, orderId, notForMe: true}});
          await router.invalidate();
        } finally {
          setPending(false);
        }
      }}
    >
      <FaXmark />
    </IconButton>
  );
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
      {props.total < 0 ? '' : '+'}
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
      gap="3"
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
