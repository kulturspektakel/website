import {and, eq, inArray, isNotNull, notInArray} from 'drizzle-orm';
import {db} from './db.server';
import {crewCardHolder} from './db/schema';
import {conversationMembers} from './slack.server';
import {SlackChannel} from '../utils/slackChannels';
import {refreshHolderWalletPasses} from './crewCardPass.server';

/**
 * Wallet pass messages for a privilege change. The pass's header shows the
 * status ("Bonbude" or "Crew"); the message is what makes Wallet notify.
 */
const GRANTED_PASS_MESSAGE = 'Bonbude freigeschaltet';
const REVOKED_PASS_MESSAGE = 'Bonbude-Zugang entfernt';

/**
 * The Bonbude privilege on CrewCards, driven by the membership of #bonbude.
 * `Viewer.id` is the Slack user id and `CrewCardHolder.viewerId` points at it,
 * so channel membership maps straight onto holders, whose `privileged` covers
 * all their cards: `src/server/kultcash.ts` turns it into the devices'
 * `privilegeTokens` list (the serials of their live cards).
 *
 * Membership changes reach us as `member_joined_channel`/`member_left_channel`
 * events (`src/server/slack/events.ts`). Nickname holders (no Slack account)
 * are never touched and stay whatever they were set to by hand.
 *
 * Filtering on the current value makes a redundant event a zero-row write.
 */

export async function grantBonbudePrivilege(viewerId: string): Promise<number> {
  const changed = await db
    .update(crewCardHolder)
    .set({privileged: true})
    .where(
      and(
        eq(crewCardHolder.viewerId, viewerId),
        eq(crewCardHolder.privileged, false),
      ),
    )
    .returning({id: crewCardHolder.id});
  if (changed.length > 0) {
    console.log(`[crew-card-privileges] granted for ${viewerId}`);
  }
  await refreshHolderWalletPasses(
    changed.map(({id}) => id),
    {message: GRANTED_PASS_MESSAGE},
  );
  return changed.length;
}

export async function revokeBonbudePrivilege(
  viewerId: string,
): Promise<number> {
  const changed = await db
    .update(crewCardHolder)
    .set({privileged: false})
    .where(
      and(
        eq(crewCardHolder.viewerId, viewerId),
        eq(crewCardHolder.privileged, true),
      ),
    )
    .returning({id: crewCardHolder.id});
  if (changed.length > 0) {
    console.log(`[crew-card-privileges] revoked for ${viewerId}`);
  }
  await refreshHolderWalletPasses(
    changed.map(({id}) => id),
    {message: REVOKED_PASS_MESSAGE},
  );
  return changed.length;
}

/**
 * Whether a Slack user is in #bonbude. Slack has no single-user membership call
 * for a bot token, so this pulls the whole member list. Used when a card is
 * issued, where no membership event fires but a new holder still needs to end
 * up with the right privilege.
 *
 * A failing Slack call resolves to `false` rather than throwing: not
 * privileging a card is recoverable (re-join the channel, or assign again),
 * failing the modal submit is not.
 */
export async function isBonbudeMember(viewerId: string): Promise<boolean> {
  try {
    const members = await conversationMembers(SlackChannel.bonbude);
    return members.includes(viewerId);
  } catch (e) {
    console.error(
      '[crew-card-privileges] #bonbude membership lookup failed',
      e,
    );
    return false;
  }
}

/**
 * Reconciles every holder against the full #bonbude member list, treating the
 * channel as the source of truth for all holders that have a `viewerId`: in
 * the channel → privileged, out of it → not.
 *
 * Not on a schedule — the events above keep things in sync. This is the manual
 * repair path behind the `/bonbude` slash command, for when an event was never
 * delivered. Returns `null` if the channel reads back empty, in which case
 * nothing is written.
 */
export async function reconcileBonbudePrivileges(): Promise<{
  granted: number;
  revoked: number;
} | null> {
  const members = await conversationMembers(SlackChannel.bonbude);
  if (members.length === 0) {
    // Can't happen in practice (the bot itself is a member), but bail rather
    // than revoke every card if Slack ever hands back an empty channel.
    console.warn('[crew-card-privileges] #bonbude looks empty, skipping');
    return null;
  }

  const [granted, revoked] = await Promise.all([
    db
      .update(crewCardHolder)
      .set({privileged: true})
      .where(
        and(
          inArray(crewCardHolder.viewerId, members),
          eq(crewCardHolder.privileged, false),
        ),
      )
      .returning({id: crewCardHolder.id}),
    db
      .update(crewCardHolder)
      .set({privileged: false})
      .where(
        and(
          // `IS NOT NULL` keeps nickname holders out of it.
          isNotNull(crewCardHolder.viewerId),
          notInArray(crewCardHolder.viewerId, members),
          eq(crewCardHolder.privileged, true),
        ),
      )
      .returning({id: crewCardHolder.id}),
  ]);

  if (granted.length > 0 || revoked.length > 0) {
    console.log(
      `[crew-card-privileges] reconciled: granted ${granted.length}, revoked ${revoked.length}`,
    );
  }
  await refreshHolderWalletPasses(
    granted.map(({id}) => id),
    {message: GRANTED_PASS_MESSAGE},
  );
  await refreshHolderWalletPasses(
    revoked.map(({id}) => id),
    {message: REVOKED_PASS_MESSAGE},
  );
  return {granted: granted.length, revoked: revoked.length};
}
