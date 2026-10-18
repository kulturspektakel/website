import {and, eq, gt, inArray, isNotNull, notInArray} from 'drizzle-orm';
import {db} from './db.server';
import {crewCard} from './db/schema';
import {conversationMembers} from './slack.server';
import {SlackChannel} from '../utils/slackChannels';

/**
 * The Bonbude privilege on CrewCards, driven by the membership of #bonbude.
 * `Viewer.id` is the Slack user id and `CrewCard.viewerId` points at it, so
 * channel membership maps straight onto cards — `privileged` is what
 * `src/server/kultcash.ts` turns into the devices' `privilegeTokens` list.
 *
 * Membership changes reach us as `member_joined_channel`/`member_left_channel`
 * events (`src/server/slack/events.ts`); this used to be a 10-minute polling
 * cron. Cards with no `viewerId` (nickname-only holders, who have no Slack
 * account to add) are never touched and stay whatever they were set to by hand.
 *
 * The two directions are deliberately asymmetric — see the doc comments below.
 *
 * Filtering on `privileged` on both sides makes a redundant event a zero-row
 * write.
 */

/**
 * Granting is limited to currently-valid, unsuspended cards. Assigning a card
 * suspends the viewer's previous ones, which keep their `viewerId`, so without
 * those filters we'd re-privilege dead cards.
 */
export async function grantBonbudePrivilege(viewerId: string): Promise<number> {
  const {length: count} = await db
    .update(crewCard)
    .set({privileged: true})
    .where(
      and(
        eq(crewCard.viewerId, viewerId),
        gt(crewCard.validUntil, new Date()),
        eq(crewCard.suspended, false),
        eq(crewCard.privileged, false),
      ),
    )
    .returning({id: crewCard.id});
  if (count > 0) {
    console.log(`[crew-card-privileges] granted ${count} for ${viewerId}`);
  }
  return count;
}

/**
 * Revoking applies regardless of validity or suspension, because `handleLists`
 * ships every privileged, unsuspended card with no `validUntil`
 * filter — an *expired* privileged card is still shipped to the devices, so
 * leaving one privileged would leave it live.
 */
export async function revokeBonbudePrivilege(
  viewerId: string,
): Promise<number> {
  const {length: count} = await db
    .update(crewCard)
    .set({privileged: false})
    .where(and(eq(crewCard.viewerId, viewerId), eq(crewCard.privileged, true)))
    .returning({id: crewCard.id});
  if (count > 0) {
    console.log(`[crew-card-privileges] revoked ${count} for ${viewerId}`);
  }
  return count;
}

/**
 * Whether a Slack user is in #bonbude. Slack has no single-user membership call
 * for a bot token, so this pulls the whole member list. Used when a card is
 * assigned, where no membership event fires but the card still needs to end up
 * with the right privilege.
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
 * Reconciles every card against the full #bonbude member list, treating the
 * channel as the source of truth for all cards that have a `viewerId`: in the
 * channel → privileged, out of it → not.
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
      .update(crewCard)
      .set({privileged: true})
      .where(
        and(
          inArray(crewCard.viewerId, members),
          gt(crewCard.validUntil, new Date()),
          eq(crewCard.suspended, false),
          eq(crewCard.privileged, false),
        ),
      )
      .returning({id: crewCard.id}),
    db
      .update(crewCard)
      .set({privileged: false})
      .where(
        and(
          // `IS NOT NULL` keeps nickname-only cards out of it.
          isNotNull(crewCard.viewerId),
          notInArray(crewCard.viewerId, members),
          eq(crewCard.privileged, true),
        ),
      )
      .returning({id: crewCard.id}),
  ]);

  if (granted.length > 0 || revoked.length > 0) {
    console.log(
      `[crew-card-privileges] reconciled: granted ${granted.length}, revoked ${revoked.length}`,
    );
  }
  return {granted: granted.length, revoked: revoked.length};
}
