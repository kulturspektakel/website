import {fetchUser, sendMessage} from '../slack.server';
import {upsertViewer} from '../upsertViewer.server';
import {walletCardFor} from '../crewCards.server';
import {signPassDownloadToken} from '../crewCardPassToken.server';
import {SlackChannel} from '../../utils/slackChannels';
import {
  byteArrayToString,
  formatLastValidDay,
  formatSerial,
} from '../../utils/cardUtils';
import {isAppleWalletConfigured} from '../appleWallet/pass.server';

/**
 * The `/crewcard` slash command: hands the calling Slack user their Apple
 * Wallet CrewCard and replies (ephemerally) with a link to their holder page
 * that adds the pass for its first minutes (`?pass=<token>`).
 *
 * A live, unexpired wallet card is handed out again (new phone, deleted pass):
 * nothing is issued or suspended. Otherwise a new wallet card is issued, valid
 * until the day after the next Kulturspektakel; an expired one is replaced. A
 * physical card is left alone either way. No Wallet pass is generated yet.
 */
export async function handleCrewCardCommand(
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const userId = String(form.get('user_id') ?? '');

  const slackUser = await fetchUser(userId);
  if (!slackUser) {
    throw new Error('Slack user not found');
  }
  const viewer = await upsertViewer(slackUser);

  const result = await walletCardFor(viewer.id, new Date());
  if (!result.ok) {
    return Response.json({
      text: `⚠️ CrewCard wurde nicht erstellt: ${result.error}`,
    });
  }
  const {card, pageToken} = result;
  const replaced = 'issued' in result && result.issued.replaced;
  const validThrough = formatLastValidDay(card.validUntil);

  if ('issued' in result) {
    // The channel's record of every card, like the enrollment message for
    // physical cards. A failed post doesn't fail the command: the card exists.
    let channelText = `<@${userId}> hat sich die Wallet-CrewCard \`${formatSerial(byteArrayToString(result.card.serial))}\` erstellt. Gültig bis einschließlich ${validThrough}.`;
    if (replaced) {
      channelText +=
        '\nDie bisherige Wallet-CrewCard für diese Person wurde deaktiviert.';
    }
    await sendMessage({
      channel: SlackChannel.crewcards,
      text: channelText,
    }).catch((e) => console.error('[crewcard] #crewcards post failed', e));
  }

  // The holder page, which with Wallet set up also adds the pass when opened
  // within a few minutes (the download token's lifetime).
  let url = `https://www.kulturspektakel.de/crewcard/${pageToken}`;
  let text = `Deine CrewCard ist gültig bis einschließlich ${validThrough}: `;
  if (isAppleWalletConfigured()) {
    url += `?pass=${signPassDownloadToken(card.id)}`;
    text += `${url}\nÖffne den Link innerhalb von 5 Minuten auf deinem iPhone, um die CrewCard zu Apple Wallet hinzuzufügen.`;
  } else {
    text += url;
  }
  if (replaced) {
    text += '\nDeine bisherige Wallet-CrewCard wurde deaktiviert.';
  }
  return Response.json({text});
}
