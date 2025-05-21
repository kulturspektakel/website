import {
  Avatar,
  Box,
  Text,
  defineStyle,
  Flex,
  Heading,
  VStack,
  Button,
  ListRoot,
} from '@chakra-ui/react';
import InfoText from '../components/kultcard/InfoText';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {CardActivities, Cell} from '../components/kultcard/CardActivities';
import {prismaClient} from '../utils/prismaClient';
import {BadgeActivity} from '../components/kultcard/Badges';
import {SegmentedControl} from '../components/chakra-snippets/segmented-control';
import {useRef, useState} from 'react';
import {useBadges} from '../utils/useBadges';

function decodePayload(hash: string) {
  const binary = atob(hash);
  const bytes = new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
  const payload = byteArrayToString(bytes);
  return {
    cardId: payload.substring(0, 14),
  };
}

function byteArrayToString(bytes: Uint8Array) {
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function stringToByteArray(str: string) {
  return new Uint8Array(str.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

const loader = createServerFn()
  .validator((data: {hash: string; event: {start: Date; end: Date}}) => data)
  .handler(async ({data: {hash, event}}) => {
    const {cardId} = decodePayload(hash);
    const _crewCard = await prismaClient.crewCard.findUnique({
      where: {
        id: stringToByteArray(cardId),
      },
      select: {
        validUntil: true,
        privileged: true,
        suspended: true,
        nickname: true,
        Viewer: {
          select: {
            displayName: true,
            profilePicture: true,
          },
        },
        Order: {
          where: {
            createdAt: {
              lt: event.end,
              gt: event.start,
            },
          },
          select: {
            createdAt: true,
            OrderItem: {
              select: {
                name: true,
                amount: true,
                ProductList: {
                  select: {
                    id: true,
                    name: true,
                    emoji: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!_crewCard) {
      throw notFound();
    }

    const _highscores = await prismaClient.$queryRaw<
      Array<{
        productListId: number;
        emoji: string | null;
        name: string;
        cardId: Uint8Array;
        nickname: string | null;
        displayName: string | null;
        amount: BigInt;
        rnk: BigInt;
      }>
    >`SELECT * FROM (
          SELECT
            pl.id AS "productListId",
            pl.emoji,
            pl.name,
            c.id AS "cardId",
            c.nickname,
            v."displayName",
            SUM(oi.amount) AS "amount",
            RANK() OVER (PARTITION BY pl.id ORDER BY SUM(oi.amount) DESC) AS rnk
          FROM "ProductList" pl
          JOIN "OrderItem" oi ON oi."productListId" = pl.id
          JOIN "Order" o ON o.id = oi."orderId"
          JOIN "CrewCard" c ON o."crewCardId" = c.id
          JOIN "Viewer" v ON c."viewerId" = v.id
          WHERE pl.active AND o."crewCardId" IS NOT NULL AND o."createdAt" > ${event.start} AND o."createdAt" < ${event.end}
          GROUP BY 1, 2, 3, 4, 5, 6
        ) ranked
        WHERE rnk <= 3
        ORDER BY "productListId", rnk;`;

    const highscores = _highscores.map(({cardId, amount, rnk, ...h}) => ({
      ...h,
      cardId: byteArrayToString(cardId),
      amount: Number(amount),
      rnk: Number(rnk),
    }));

    const {Order, ...crewCard} = _crewCard;

    return {
      highscores: highscores.reduce<Record<number, typeof highscores>>(
        (acc, cv) => {
          if (!acc[cv.productListId]) {
            acc[cv.productListId] = [];
          }
          acc[cv.productListId].push(cv);
          return acc;
        },
        {},
      ),
      crewCard,
      cardActivities: Order.map((o) => ({
        type: 'order' as const,
        productList: o.OrderItem[0].ProductList?.name!,
        emoji: o.OrderItem[0].ProductList?.emoji ?? null,
        items: o.OrderItem,
        time: o.createdAt,
      })),
      totals: {
        Konsum: Order.reduce(
          (acc, cv) =>
            acc + cv.OrderItem.reduce((acc, cv) => acc + cv.amount, 0),
          0,
        ),
        Highscores: highscores.reduce(
          (acc, cv) => (cv.cardId === cardId ? acc + 1 : acc),
          0,
        ),
        Badges: 0, // client side computed
      },
      event,
    };
  });

export const Route = createFileRoute('/crewcard/$hash')({
  component: CrewCard,
  loader: async ({params, context}) =>
    await loader({data: {event: context.event, hash: params.hash}}),
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

const ringCss = defineStyle({
  outlineWidth: '3px',
  outlineColor: 'blue.500',
  outlineOffset: '2px',
  outlineStyle: 'solid',
});

const TABS = ['Konsum', 'Badges', 'Highscores'];

function CrewCard() {
  const {crewCard, highscores, totals, cardActivities, event} =
    Route.useLoaderData();
  const {hash} = Route.useParams();
  const cardId = decodePayload(hash).cardId;
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(TABS[0]);
  const name = crewCard.Viewer?.displayName ?? crewCard.nickname ?? 'Unbekannt';
  const {awardedBadges, unawardedBadges} = useBadges(
    cardActivities,
    event,
    true,
  );
  totals.Badges = awardedBadges.length;

  return (
    <VStack gap="5" align="stretch">
      <Flex
        direction="column"
        shadow="2xl"
        bg="white"
        borderRadius="2xl"
        aspectRatio={0.63}
        alignItems="center"
        position="relative"
        justifyContent="space-between"
        p="5"
        pb="3"
        maxW="320px"
        mx="auto"
        overflow="hidden"
      >
        <Box
          w="15%"
          aspectRatio={6}
          bg="offwhite.100"
          borderRadius="full"
          boxShadow="inset"
        />
        <Box w="50%" aspectRatio={1}>
          <Avatar.Root
            css={ringCss}
            size="full"
            background="linear-gradient(141deg,rgba(131, 58, 180, 1) 0%, rgba(253, 29, 29, 1) 50%, rgba(252, 176, 69, 1) 100%)"
          >
            <Avatar.Fallback
              name={name ?? '?'}
              fontFamily="Shrimp"
              fontSize="7xl"
              color="white"
            />
            {crewCard.Viewer?.profilePicture && (
              <Avatar.Image
                width="auto"
                aspectRatio={1}
                objectFit="cover"
                src={crewCard.Viewer.profilePicture}
              />
            )}
          </Avatar.Root>
        </Box>
        <Box textAlign="center">
          <Heading fontSize="3xl">{name}</Heading>
          <Text fontSize="lg" mt="1" opacity="0.5">
            {crewCard.privileged ? 'Bonbude' : 'Kulturspektakel Crew'}
          </Text>
        </Box>
        {(crewCard.suspended || crewCard.validUntil < new Date()) && (
          <Box
            background="brand.500"
            color="white"
            position="absolute"
            fontWeight="bold"
            textTransform="uppercase"
            transformOrigin="top center"
            transform="translateX(50%) rotate(45deg)"
            top="10"
            right="10"
            fontSize="xl"
            px="20"
          >
            ungültig
          </Box>
        )}
        <VStack gap="2">
          <Flex direction="row" w="full" mb="3">
            {TABS.map((t) => (
              <Button
                display="flex"
                background="transparent"
                gap="3"
                color="black"
                flexDirection="column"
                textAlign="center"
                flexGrow="1"
                flexBasis="0"
                onClick={() => {
                  ref.current?.scrollIntoView({
                    block: 'start',
                    behavior: 'smooth',
                  });
                  setActive(t);
                }}
              >
                <Box
                  textTransform="uppercase"
                  opacity="0.5"
                  fontSize="sm"
                  fontWeight="bold"
                >
                  {t}
                </Box>
                <Text fontSize="4xl">{totals[t] ?? 0}</Text>
              </Button>
            ))}
          </Flex>
          <Text textAlign="center" opacity="0.5">
            {cardId.match(/.{1,2}/g)?.join(':')}
          </Text>
        </VStack>
      </Flex>

      <SegmentedControl
        mt="10"
        value={active}
        onValueChange={({value}) => setActive(value!)}
        items={TABS.map((t) => ({value: t, label: t}))}
        ref={ref}
      />
      {active === 'Konsum' && (
        <CardActivities newestToOldest={cardActivities} />
      )}
      {active === 'Badges' && (
        <BadgeActivity
          awardedBadges={awardedBadges}
          unawardedBadges={unawardedBadges}
        />
      )}
      {active === 'Highscores' && (
        <>
          {Object.values(highscores).map((values) => (
            <>
              <Heading textAlign="center" mt="3">
                {values[0].emoji} {values[0].name}
              </Heading>
              <ListRoot as="ol" m="0">
                {values.map((value) => (
                  <Highscore
                    key={value.cardId}
                    name={value.displayName ?? value.nickname ?? 'Unbekannt'}
                    place={value.rnk}
                    points={value.amount}
                  />
                ))}
              </ListRoot>
            </>
          ))}
        </>
      )}
      <InfoText textAlign="center">
        Es kann etwas dauern, bis alle Buchungen vollständig in der Liste
        dargestellt werden.
      </InfoText>
    </VStack>
  );
}

function Highscore({
  name,
  place,
  points,
}: {
  place: number;
  name: string;
  points: number;
}) {
  return (
    <Cell
      accessoryStart={place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
      subtitle={<Text fontWeight="bold">{name}</Text>}
      accessoryEnd={points}
    />
  );
}
