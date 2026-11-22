import {Box, Button, HStack, Text, VStack} from '@chakra-ui/react';
import {FaApple, FaCreditCard} from 'react-icons/fa6';
import {Tooltip} from '../components/chakra-snippets/tooltip';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {useEffect, useState} from 'react';
import {seo} from '../utils/seo';
import {useBadges} from '../utils/useBadges';
import {validateBadgeSearch} from '../utils/badgeConfig';
import {byteArrayToString, formatSerial} from '../utils/cardUtils';
import {CrewCardType} from '../utils/enums';
import {CardDetails} from '../components/kultcard/CardDetails';
import {CrewCardInfo} from '../components/kultcard/CrewCardInfo';
import {CrewCardFace} from '../components/kultcard/CrewCardFace';
import {
  bookedItems,
  holderName,
  orderToCardActivity,
  queryHolder,
} from '../server/cardUtils.server';
import {currentEventQuery} from '../server/currentEvent';
import {and, eq, isNull} from 'drizzle-orm';
import {db} from '../server/db.server';
import {crewCard} from '../server/db/schema';

const loader = createServerFn()
  .validator((data: {token: string; event: {start: Date; end: Date}}) => data)
  .handler(async ({data: {token, event}}) => {
    const holder = await queryHolder({pageToken: token}, event);
    if (!holder) {
      throw notFound();
    }
    const liveCards = await db
      .select({
        serial: crewCard.serial,
        cardType: crewCard.cardType,
        validUntil: crewCard.validUntil,
      })
      .from(crewCard)
      .where(
        and(eq(crewCard.holderId, holder.id), isNull(crewCard.suspendedAt)),
      )
      .orderBy(crewCard.cardType);
    return {
      holder: {
        id: holder.id,
        name: holderName(holder),
        profilePicture: holder.viewer?.profilePicture ?? null,
        privileged: holder.privileged,
      },
      liveCards: liveCards.map((card) => ({
        cardType: card.cardType,
        serial: byteArrayToString(card.serial),
        validUntil: card.validUntil,
      })),
      cardActivities: orderToCardActivity(holder.orders),
      bookings: bookedItems(holder.orders),
      event,
    };
  });

/**
 * A CrewCard holder's page: their cards and everything booked with any of
 * them, old ones included. Reached through `/card/<payload>/crew` (scanning a
 * live card redirects here) and the `/crewcard` reply. `token` is the holder's
 * `pageToken`, which is rotated when a card is reported lost.
 */
export const Route = createFileRoute('/_main/crewcard/$token')({
  component: HolderPage,
  validateSearch: (search: {badge?: unknown; pass?: unknown}) => ({
    ...validateBadgeSearch(search),
    ...(typeof search.pass === 'string' ? {pass: search.pass} : {}),
  }),
  loader: async ({params, context}) => {
    const {event} =
      await context.queryClient.ensureQueryData(currentEventQuery);
    return await loader({data: {event, token: params.token}});
  },
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

/**
 * Opened with `?pass=<token>` (the `/crewcard` reply), the page starts the
 * Wallet pass download itself: Safari shows the pass as a sheet over this
 * page, which is where the user lands afterwards. The download route checks
 * the token (valid for a few minutes). The param is dropped from the URL right
 * away, so reloads and bookmarks are just the page. Returns the pass URL for a
 * fallback button.
 */
function useWalletPassDownload(): string | null {
  const {pass} = Route.useSearch();
  const [passUrl, setPassUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pass) {
      return;
    }
    // Not through the router: that would re-run the loader for nothing.
    const url = new URL(window.location.href);
    url.searchParams.delete('pass');
    window.history.replaceState(
      window.history.state,
      '',
      url.pathname + url.search,
    );
    const passUrl = `/api/crewcard/wallet/apple/${encodeURIComponent(pass)}`;
    setPassUrl(passUrl);
    window.location.assign(passUrl);
    // Once, for the URL the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return passUrl;
}

function HolderPage() {
  const {holder, liveCards, cardActivities, bookings, event} =
    Route.useLoaderData();
  const {token} = Route.useParams();
  const {badge, pass} = Route.useSearch();
  const walletPassUrl = useWalletPassDownload();
  const {awardedBadges} = useBadges(cardActivities, event, true);
  const now = new Date();
  const validCards = liveCards.filter((card) => card.validUntil > now);

  return (
    <CardDetails
      infoText={
        'Es kann etwas dauern, bis alle Buchungen vollständig in der Liste dargestellt werden.'
      }
      cardActivities={cardActivities}
      cardId={holder.id}
      cardType="crew"
      notForMeOwner={{pageToken: token}}
      linkedBadge={badge}
      // Not over the Wallet pass sheet a `?pass=` link opens.
      footer={<CrewCardInfo autoOpen={!pass} />}
    >
      <CrewCardFace
        name={holder.name}
        profilePicture={holder.profilePicture}
        privileged={holder.privileged}
        invalid={validCards.length === 0}
        totals={{Buchungen: bookings, Badges: awardedBadges.length}}
        corner={
          <HStack gap="2">
            {liveCards.map((card) => (
              <CardIcon key={card.serial} card={card} now={now} />
            ))}
          </HStack>
        }
        mb={walletPassUrl ? '4' : '8'}
      />
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

/**
 * A live card as an icon (physical card or Apple Wallet), struck through once
 * it has expired; hovering shows its id.
 */
function CardIcon({
  card,
  now,
}: {
  card: {cardType: CrewCardType; serial: string; validUntil: Date};
  now: Date;
}) {
  const expired = card.validUntil <= now;
  const label = `${expired ? 'abgelaufen · ' : ''}${formatSerial(card.serial)}`;
  const Icon =
    card.cardType === CrewCardType.APPLE_WALLET ? FaApple : FaCreditCard;
  return (
    <Tooltip content={label} showArrow openDelay={100}>
      <Box
        as="span"
        tabIndex={0}
        aria-label={label}
        fontSize="lg"
        color="gray.400"
        position="relative"
        display="inline-flex"
        // Expired: struck through with a diagonal line.
        _after={
          expired
            ? {
                content: '""',
                position: 'absolute',
                left: '-15%',
                right: '-15%',
                top: '50%',
                height: '2px',
                marginTop: '-1px',
                bg: 'red.500',
                transform: 'rotate(-45deg)',
                borderRadius: 'full',
              }
            : undefined
        }
        cursor="default"
      >
        <Icon />
      </Box>
    </Tooltip>
  );
}
