import {
  Avatar,
  Box,
  Button,
  Text,
  defineStyle,
  Flex,
  Heading,
  VStack,
} from '@chakra-ui/react';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {seo} from '../utils/seo';
import {useBadges} from '../utils/useBadges';
import {CardDetails} from '../components/kultcard/CardDetails';
import {CrewCardInfo} from '../components/kultcard/CrewCardInfo';
import {createServerFn} from '@tanstack/react-start';
import {queryCrewCard, orderToCardActivity} from '../server/cardUtils.server';
import {currentEventQuery} from '../server/currentEvent';
import {stringToByteArray} from '../utils/cardUtils';
import {decodePayload} from '../utils/decodePayload';
import {CrewCardType} from '../utils/enums';
import {
  isWithinWalletDownloadWindow,
  WalletProvider,
} from '../utils/walletPass';
import {useEffect, useState} from 'react';

const loader = createServerFn()
  .validator((data: {hash: string; event: {start: Date; end: Date}}) => data)
  .handler(async ({data: {hash, event}}) => {
    const {cardId, validUntil} = decodePayload('crewcard', hash);
    const _crewCard = await queryCrewCard(stringToByteArray(cardId), event);

    if (!_crewCard) {
      throw notFound();
    }

    const {orders, ...crewCard} = _crewCard;

    return {
      crewCard,
      cardActivities: orderToCardActivity(orders),
      totals: {
        Buchungen: orders.reduce(
          (acc, cv) =>
            acc + cv.orderItems.reduce((acc, cv) => acc + cv.amount, 0),
          0,
        ),
        Badges: 0 as number,
      },
      event,
      cardId,
      validUntil,
    };
  });

export const Route = createFileRoute('/_main/card/$hash/crew')({
  component: CrewCard,
  // `/crewcard` links here with `?wallet=apple`; see `useWalletPassDownload`.
  validateSearch: (search: {wallet?: string}): {wallet?: WalletProvider} =>
    search.wallet === WalletProvider.apple ? {wallet: search.wallet} : {},
  loader: async ({params, context}) => {
    const {event} =
      await context.queryClient.ensureQueryData(currentEventQuery);
    return await loader({data: {event, hash: params.hash}});
  },
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

const ringCss = defineStyle({
  outlineWidth: '3px',
  outlineColor: 'brand.500',
  outlineOffset: '2px',
  outlineStyle: 'solid',
});

/**
 * Opened with `?wallet=apple` within minutes of `/crewcard`, the page starts
 * the pass download itself: Safari shows the pass as a sheet over this page,
 * which is where the user lands afterwards. Decided here rather than in the
 * loader so it doesn't depend on render time; the download route checks again.
 * The param is dropped from the URL right away, so reloads and bookmarks are
 * just the card page. Returns the pass URL for a fallback button.
 */
function useWalletPassDownload(
  cardType: CrewCardType,
  enrolledAt: Date,
): string | null {
  const {wallet} = Route.useSearch();
  const {hash} = Route.useParams();
  const [passUrl, setPassUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) {
      return;
    }
    // Not through the router: that would re-run the loader for nothing.
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname,
    );
    if (
      wallet === WalletProvider.apple &&
      cardType === CrewCardType.APPLE_WALLET &&
      isWithinWalletDownloadWindow(enrolledAt)
    ) {
      const url = `/api/crewcard/wallet/apple/${hash}`;
      setPassUrl(url);
      window.location.assign(url);
    }
    // Once, for the URL the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return passUrl;
}

function CrewCard() {
  const {crewCard, totals, cardActivities, event, cardId, validUntil} =
    Route.useLoaderData();
  const walletPassUrl = useWalletPassDownload(
    crewCard.cardType,
    crewCard.enrolledAt,
  );
  const name = crewCard.viewer?.displayName ?? crewCard.nickname;
  const {awardedBadges} = useBadges(cardActivities, event, true);
  totals.Badges = awardedBadges.length;

  return (
    <CardDetails
      infoText={
        'Es kann etwas dauern, bis alle Buchungen vollständig in der Liste dargestellt werden.'
      }
      cardActivities={cardActivities}
      cardId={cardId}
      cardType="crew"
      footer={<CrewCardInfo />}
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
        mb={walletPassUrl ? '4' : '8'}
      >
        <Box
          w="15%"
          aspectRatio={6}
          bg="offwhite.100"
          borderRadius="full"
          boxShadow="inset"
        />
        <Box w="50%" aspectRatio={1}>
          <Avatar.Root css={ringCss} size="full" background="brand.500">
            <Avatar.Fallback
              name={name ?? '?'}
              fontFamily="Shrimp"
              fontSize="7xl"
              color="white"
              mt="4"
            />
            {crewCard.viewer?.profilePicture && (
              <Avatar.Image
                width="auto"
                aspectRatio={1}
                objectFit="cover"
                src={crewCard.viewer.profilePicture}
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
            background="red.500"
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
            {(Object.keys(totals) as (keyof typeof totals)[]).map((t) => (
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
      {walletPassUrl && (
        <VStack gap="1" mb="8">
          <Button asChild>
            <a href={walletPassUrl}>Zu Apple Wallet hinzufügen</a>
          </Button>
          <Text fontSize="sm" opacity="0.5" textAlign="center">
            Passiert nichts? Öffne den Link in Safari.
          </Text>
        </VStack>
      )}
    </CardDetails>
  );
}
