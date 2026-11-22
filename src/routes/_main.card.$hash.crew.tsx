import {Heading, Text, VStack} from '@chakra-ui/react';
import {createFileRoute, notFound, redirect} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {eq} from 'drizzle-orm';
import {seo} from '../utils/seo';
import {useBadges} from '../utils/useBadges';
import {CardDetails} from '../components/kultcard/CardDetails';
import {CrewCardInfo} from '../components/kultcard/CrewCardInfo';
import {CrewCardFace} from '../components/kultcard/CrewCardFace';
import {
  bookedItems,
  orderToCardActivity,
  queryEnrollmentOrders,
} from '../server/cardUtils.server';
import {cardForPayload} from '../server/crewCards.server';
import {currentEventQuery} from '../server/currentEvent';
import {db} from '../server/db.server';
import {crewCardEnrollment} from '../server/db/schema';
import {formatSerial, stringToByteArray} from '../utils/cardUtils';
import {decodePayload} from '../utils/decodePayload';

/**
 * What a card link (the signed payload on the chip or in the pass) is: a live
 * card (→ its holder's page), a suspended one, or an enrolled chip nobody has
 * been assigned yet, which gets an anonymous card page.
 */
const loader = createServerFn()
  .validator(
    (data: {hash: string; event: {id: string; start: Date; end: Date}}) => data,
  )
  .handler(async ({data: {hash, event}}) => {
    let cardId: string;
    let validUntil: Date;
    try {
      ({cardId, validUntil} = decodePayload('crewcard', hash));
    } catch {
      throw notFound();
    }
    const serial = Buffer.from(stringToByteArray(cardId));

    const [card, enrollment] = await Promise.all([
      cardForPayload(serial, validUntil),
      db.query.crewCardEnrollment.findFirst({
        where: eq(crewCardEnrollment.serial, serial),
        columns: {validUntil: true},
      }),
    ]);
    if (card) {
      return card.suspendedAt
        ? {kind: 'suspended' as const, cardId}
        : {kind: 'holder' as const, pageToken: card.holder.pageToken};
    }
    if (!enrollment) {
      throw notFound();
    }
    const orders = await queryEnrollmentOrders(serial, event);
    return {
      kind: 'anonymous' as const,
      cardId,
      validUntil: enrollment.validUntil,
      cardActivities: orderToCardActivity(orders),
      bookings: bookedItems(orders),
      event,
    };
  });

export const Route = createFileRoute('/_main/card/$hash/crew')({
  component: CrewCard,
  loaderDeps: ({search: {badge}}) => ({badge}),
  loader: async ({params, context, deps}) => {
    const {event} =
      await context.queryClient.ensureQueryData(currentEventQuery);
    const result = await loader({data: {event, hash: params.hash}});
    if (result.kind === 'holder') {
      throw redirect({
        to: '/crewcard/$token',
        params: {token: result.pageToken},
        search: {badge: deps.badge},
      });
    }
    return result;
  },
  head: () =>
    seo({
      title: 'CrewCard',
    }),
});

function CrewCard() {
  const data = Route.useLoaderData();
  if (data.kind === 'suspended') {
    return (
      <VStack gap="2" py="16" textAlign="center">
        <Heading fontSize="2xl">Diese CrewCard ist nicht mehr aktiv</Heading>
        <Text opacity="0.5">{formatSerial(data.cardId)}</Text>
      </VStack>
    );
  }
  return <AnonymousCrewCard data={data} />;
}

/** An enrolled chip nobody has been assigned yet: works, but has no holder. */
function AnonymousCrewCard({
  data,
}: {
  data: Extract<ReturnType<typeof Route.useLoaderData>, {kind: 'anonymous'}>;
}) {
  const {cardId, validUntil, cardActivities, bookings, event} = data;
  const {awardedBadges} = useBadges(cardActivities, event, true);
  const {badge} = Route.useSearch();
  return (
    <CardDetails
      infoText={
        'Es kann etwas dauern, bis alle Buchungen vollständig in der Liste dargestellt werden.'
      }
      cardActivities={cardActivities}
      cardId={cardId}
      cardType="crew"
      notForMeOwner={{serial: cardId}}
      linkedBadge={badge}
      footer={<CrewCardInfo autoOpenFor={event.id} />}
    >
      <CrewCardFace
        name={null}
        profilePicture={null}
        privileged={false}
        invalid={validUntil < new Date()}
        totals={{Buchungen: bookings, Badges: awardedBadges.length}}
        footer={<Text opacity="0.5">{formatSerial(cardId)}</Text>}
        mb="8"
      />
    </CardDetails>
  );
}
