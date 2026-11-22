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
import {CardTransactionType} from '../../utils/enums';
import {FaBan, FaXmark} from 'react-icons/fa6';
import {useState} from 'react';
import {useRouter} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {and, eq, inArray} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {crewCardHolder, order} from '../../server/db/schema';
import {
  enrollmentOrderIds,
  holderOrderIds,
} from '../../server/crewCards.server';
import {stringToByteArray} from '../../utils/cardUtils';
import {locale, timeZone} from '../../utils/dateUtils';
import {refreshHolderWalletPasses} from '../../server/crewCardPass.server';

const DEPOSIT_VALUE = 200;

/**
 * Whose orders "nicht für mich" may be set on: a holder (by their page token)
 * or an enrolled chip nobody has been assigned yet (by its serial, hex).
 */
export type NotForMeOwner = {pageToken: string} | {serial: string};

const setOrderNotForMe = createServerFn({method: 'POST'})
  .validator(
    z.object({
      owner: z.union([
        z.object({pageToken: z.string()}),
        z.object({serial: z.string().regex(/^[0-9A-F]{14}$/)}),
      ]),
      orderId: z.number().int(),
      notForMe: z.boolean(),
    }),
  )
  .handler(async ({data: {owner, orderId, notForMe}}) => {
    const holder =
      'pageToken' in owner
        ? await db.query.crewCardHolder.findFirst({
            where: eq(crewCardHolder.pageToken, owner.pageToken),
            columns: {id: true},
          })
        : undefined;
    const ownOrders = holder
      ? holderOrderIds(holder.id)
      : 'serial' in owner
        ? enrollmentOrderIds(Buffer.from(stringToByteArray(owner.serial)))
        : undefined;
    if (!ownOrders) {
      return;
    }
    await db
      .update(order)
      .set({notForMe})
      .where(and(eq(order.id, orderId), inArray(order.id, ownOrders)));
    if (holder) {
      // Changes the badges a wallet pass shows.
      await refreshHolderWalletPasses([holder.id]);
    }
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
  notForMeOwner,
}: {
  newestToOldest?: Array<CardActivity>;
  notForMeOwner?: NotForMeOwner;
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
        <ActivityItem key={i} data={t} notForMeOwner={notForMeOwner} />
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
  notForMeOwner,
}: {
  data: CardActivity;
  notForMeOwner?: NotForMeOwner;
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
              {data.notForMe && notForMeOwner && data.orderId != null && (
                <NotForMeBadge owner={notForMeOwner} orderId={data.orderId} />
              )}
              {products.join(', ')}
            </Flex>
          }
          description={<CellDateTime time={data.time} />}
          accessoryEnd={
            !data.notForMe && notForMeOwner && data.orderId != null ? (
              <NotForMeButton owner={notForMeOwner} orderId={data.orderId} />
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

function NotForMeBadge({
  owner,
  orderId,
}: {
  owner: NotForMeOwner;
  orderId: number;
}) {
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
            await setOrderNotForMe({data: {owner, orderId, notForMe: false}});
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

function NotForMeButton({
  owner,
  orderId,
}: {
  owner: NotForMeOwner;
  orderId: number;
}) {
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
          await setOrderNotForMe({data: {owner, orderId, notForMe: true}});
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
        .toLocaleDateString(locale, {
          weekday: 'short',
          day: '2-digit',
          month: 'long',
          timeZone,
        })
        .replace(',', '')}
      ,&nbsp;
      {new Date(props.time).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
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
