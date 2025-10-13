import {
  Avatar,
  Box,
  Text,
  defineStyle,
  Flex,
  Heading,
  VStack,
} from '@chakra-ui/react';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {seo} from '../utils/seo';
import {prismaClient} from '../utils/prismaClient';
import {useBadges} from '../utils/useBadges';
import {
  byteArrayToString,
  orderToCardActivity,
  queryCrewCard,
  stringToByteArray,
} from '../utils/cardUtils';
import {CardDetails} from '../components/kultcard/CardDetails';
import {HighscoreEntry} from '../components/kultcard/Highscore';
import {decodePayload} from '../utils/decodePayload';

const loader = createServerFn()
  .inputValidator(
    (data: {hash: string; event: {start: Date; end: Date}}) => data,
  )
  .handler(async ({data: {hash, event}}) => {
    const {cardId, validUntil} = decodePayload('crewcard', hash);
    const _crewCard = await queryCrewCard(stringToByteArray(cardId), event);

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

    const highscores = _highscores.reduce<Record<number, HighscoreEntry[]>>(
      (acc, cv) => {
        if (!acc[cv.productListId]) {
          acc[cv.productListId] = [];
        }
        acc[cv.productListId].push({
          name: cv.displayName || cv.nickname || 'Unbekannt',
          cardId: byteArrayToString(cv.cardId),
          amount: Number(cv.amount),
          rank: Number(cv.rnk),
          productList: cv.name,
          emoji: cv.emoji,
        });
        return acc;
      },
      {},
    );

    const {Order, ...crewCard} = _crewCard;

    return {
      highscores,
      crewCard,
      cardActivities: orderToCardActivity(Order),
      totals: {
        Buchungen: Order.reduce(
          (acc, cv) =>
            acc + cv.OrderItem.reduce((acc, cv) => acc + cv.amount, 0),
          0,
        ),
        Badges: 0, // client side computed
        Highscores: Object.values(highscores)
          .flatMap((v) => v)
          .reduce((acc, cv) => (cv.cardId === cardId ? acc + 1 : acc), 0),
      },
      event,
      cardId,
      validUntil,
    };
  });

export const Route = createFileRoute('/card/$hash/crew')({
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

function CrewCard() {
  const {
    crewCard,
    totals,
    cardActivities,
    event,
    cardId,
    validUntil,
    highscores,
  } = Route.useLoaderData();
  const name = crewCard.Viewer?.displayName ?? crewCard.nickname;
  const {awardedBadges} = useBadges(cardActivities, event, true);
  totals.Badges = awardedBadges.length;

  return (
    <CardDetails
      infoText={
        'Es kann etwas dauern, bis alle Buchungen vollständig in der Liste dargestellt werden.'
      }
      cardActivities={cardActivities}
      cardId={cardId}
      highscores={highscores}
      cardType="crew"
    >
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
        maxW="290px"
        w="full"
        mx="auto"
        overflow="hidden"
        mb="8"
      >
        <Box
          w="15%"
          aspectRatio={6}
          bg="offwhite.100"
          borderRadius="full"
          boxShadow="inset"
        />
        <Box w="50%" aspectRatio={1}>
          <Avatar.Root css={ringCss} size="full" background="blue.500">
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
          <Heading fontSize="3xl">{name ?? 'Unbekannt'}</Heading>
          <Text fontSize="lg" mt="1" opacity="0.5">
            {crewCard.privileged ? 'Bonbude' : 'Kulturspektakel Crew'}
          </Text>
        </Box>
        {(crewCard.suspended || validUntil < new Date()) && (
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
        <VStack gap="2" w="full">
          <Flex direction="row" w="full" mb="3">
            {Object.keys(totals).map((t) => (
              <Flex
                key={t}
                gap="3"
                flexDirection="column"
                textAlign="center"
                flexGrow="1"
                flexBasis="0"
              >
                <Box
                  textTransform="uppercase"
                  opacity="0.5"
                  fontSize="xs"
                  fontWeight="bold"
                >
                  {t}
                </Box>
                <Text mt="-5" fontSize="4xl">
                  {totals[t] ?? 0}
                </Text>
              </Flex>
            ))}
          </Flex>
          <Text fontSize="sm" textAlign="center" opacity="0.5">
            {cardId.match(/.{1,2}/g)?.join(':')}
          </Text>
        </VStack>
      </Flex>
    </CardDetails>
  );
}
