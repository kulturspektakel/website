import {prismaClient} from '../../server/prismaClient.server';
import {conversationMembers} from '../../server/slack.server';
import {SlackChannel} from '../../utils/slackChannels';

/**
 * Cron (every 10 min via Cloud Scheduler): syncs the Bonbude privilege with the
 * membership of #bonbude. `Viewer.id` is the Slack user id and
 * `CrewCard.viewerId` points at it, so channel membership maps straight onto
 * cards — `privileged` is what `src/server/kultcash.ts` turns into the devices'
 * `privilegeTokens` list.
 *
 * The channel is the source of truth for every card that has a `viewerId`: in
 * the channel → privileged, out of it → not. Cards with no `viewerId`
 * (nickname-only holders, who have no Slack account to add) are never touched
 * and stay whatever they were set to by hand.
 *
 * The two directions are deliberately asymmetric:
 *   - Granting is limited to currently-valid, unsuspended cards. Assigning a
 *     card suspends the viewer's previous ones, which keep their `viewerId`, so
 *     without those filters we'd re-privilege dead cards.
 *   - Revoking applies regardless of validity or suspension, because
 *     `handleLists` selects `{privileged: true, suspended: {not: true}}` with no
 *     `validUntil` filter — an *expired* privileged card is still shipped to the
 *     devices, so leaving one privileged would leave it live.
 */
export async function handleCrewCardPrivileges(): Promise<Response> {
  const members = await conversationMembers(SlackChannel.bonbude);
  if (members.length === 0) {
    // Can't happen in practice (the bot itself is a member), but bail rather
    // than revoke every card if Slack ever hands back an empty channel.
    console.warn('[crew-card-privileges] #bonbude looks empty, skipping');
    return new Response(null, {status: 204});
  }

  // `suspended`/`privileged` are nullable booleans, so `{not: true}` (rather
  // than `false`) is needed to also match NULL. Filtering on `privileged` on
  // both sides makes a run a no-op once the channel and the DB agree.
  const [granted, revoked] = await Promise.all([
    prismaClient.crewCard.updateMany({
      where: {
        viewerId: {in: members},
        validUntil: {gt: new Date()},
        suspended: {not: true},
        privileged: {not: true},
      },
      data: {privileged: true},
    }),
    prismaClient.crewCard.updateMany({
      where: {
        viewerId: {notIn: members, not: null},
        privileged: true,
      },
      data: {privileged: false},
    }),
  ]);

  if (granted.count > 0 || revoked.count > 0) {
    console.log(
      `[crew-card-privileges] granted ${granted.count}, revoked ${revoked.count}`,
    );
  }

  return new Response(null, {status: 204});
}
