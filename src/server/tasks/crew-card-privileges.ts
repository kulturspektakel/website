import {prismaClient} from '../../server/prismaClient.server';
import {conversationMembers} from '../../server/slack.server';
import {SlackChannel} from '../../utils/slackChannels';

/**
 * Cron (every 10 min via Cloud Scheduler): grants the Bonbude privilege to the
 * crew cards of everyone in #bonbude. `Viewer.id` is the Slack user id and
 * `CrewCard.viewerId` points at it, so channel membership maps straight onto
 * cards — `privileged` is what `src/server/kultcash.ts` turns into the devices'
 * `privilegeTokens` list.
 *
 * Grant-only by design: leaving the channel does not revoke the flag (it is
 * reset on re-enrollment, and can be cleared by hand). Suspended cards are
 * skipped — assigning a card suspends the viewer's previous ones, which keep
 * their `viewerId` — and so are expired ones.
 */
export async function handleCrewCardPrivileges(): Promise<Response> {
  const members = await conversationMembers(SlackChannel.bonbude);
  if (members.length === 0) {
    return new Response(null, {status: 204});
  }

  const {count} = await prismaClient.crewCard.updateMany({
    where: {
      viewerId: {in: members},
      validUntil: {gt: new Date()},
      // `suspended`/`privileged` are nullable booleans, so `{not: true}` (not
      // `false`) is needed to match NULL. Excluding already-privileged cards
      // makes the run a no-op once everyone is granted.
      suspended: {not: true},
      privileged: {not: true},
    },
    data: {privileged: true},
  });

  if (count > 0) {
    console.log(`[crew-card-privileges] granted privilege to ${count} card(s)`);
  }

  return new Response(null, {status: 204});
}
