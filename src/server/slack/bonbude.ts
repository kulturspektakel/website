import {reconcileBonbudePrivileges} from '../crewCardPrivileges.server';

/**
 * The `/bonbude` slash command: forces a full reconcile of the CrewCard Bonbude
 * privilege against the #bonbude member list.
 *
 * Privileges are normally event-driven (`member_joined_channel` /
 * `member_left_channel` in `./events.ts`), so this is only needed when an event
 * was never delivered and a card is stuck in the wrong state.
 */
export async function handleBonbudeCommand(
  _request: Request,
): Promise<Response> {
  const result = await reconcileBonbudePrivileges();

  if (!result) {
    return Response.json({
      text: '⚠️ Slack liefert #bonbude als leer zurück, es wurde nichts geändert.',
    });
  }

  const {granted, revoked} = result;
  if (granted === 0 && revoked === 0) {
    return Response.json({
      text: 'Alle CrewCards stimmen bereits mit #bonbude überein, nichts zu tun.',
    });
  }

  return Response.json({
    text: `Bonbude-Privileg abgeglichen: ${granted} vergeben, ${revoked} entzogen.`,
  });
}
