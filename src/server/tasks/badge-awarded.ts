import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {orderToCardActivity, queryCrewCard} from '../../server/cardUtils.server';
import {computeBadges} from '../../utils/useBadges';
import {badgeConfig} from '../../utils/badgeConfig';
import {getCurrentEvent} from '../../server/getCurrentEvent.server';
import {slackApiRequest} from '../../server/slack.server';

/**
 * Triggered from `kultcash.ts` whenever a CrewCard order lands. Recomputes
 * the cardholder's badges with the new order included, diffs against the
 * pre-order badges, and DMs them on Slack for each newly-awarded one.
 *
 * Previously this task lived in `~/api.kulturspektakel.de/src/tasks/badgeAwarded.ts`
 * and called back into this codebase via `/api/badges` to compute the diff —
 * now both sides live here, so that round-trip endpoint is gone.
 */
export async function handleBadgeAwarded(request: Request): Promise<Response> {
  const {orderId} = await readJsonPayload<{orderId: number}>(request);

  const order = await prismaClient.order.findUnique({
    where: {id: orderId},
    include: {crewCard: {include: {viewer: true}}},
  });
  if (!order?.crewCardId || !order.crewCard?.viewer) {
    return new Response(null, {status: 204});
  }

  const event = await getCurrentEvent();
  const crewCard = await queryCrewCard(new Uint8Array(order.crewCardId), event);
  if (!crewCard) {
    return new Response(null, {status: 204});
  }

  const oldBadges = computeBadges(
    orderToCardActivity(crewCard.Order.filter((o) => o.id !== orderId)),
    event,
    true,
  ).filter((b) => b.status === 'awarded');
  const newBadges = computeBadges(
    orderToCardActivity(crewCard.Order),
    event,
    true,
  ).filter((b) => b.status === 'awarded');

  const newlyAwarded = newBadges.filter((nb) =>
    oldBadges.every((ob) => ob.badgeKey !== nb.badgeKey),
  );

  const viewerSlackId = order.crewCard.viewer.id;
  await Promise.all(
    newlyAwarded.map((badge) =>
      slackApiRequest('chat.postMessage', {
        channel: viewerSlackId,
        text: `🎖️ Gratulation, du hast den ${badgeConfig[badge.badgeKey].name} Badge erhalten! Scanne deine CrewCard mit deinem Handy um deinen Badge zu sehen.`,
      }),
    ),
  );

  return new Response(null, {status: 204});
}
