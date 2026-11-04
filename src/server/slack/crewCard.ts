import {subDays} from 'date-fns';
import {fetchUser, sendMessage} from '../slack.server';
import {upsertViewer} from '../upsertViewer.server';
import {
  assignCrewCardToHolder,
  newWalletAuthToken,
  newWalletCardId,
  nextKulturspektakel,
  walletCardValidity,
} from '../crewCards.server';
import {encodeCrewCardPayload} from '../../utils/decodePayload';
import {CrewCardType} from '../../utils/enums';
import {SlackChannel} from '../../utils/slackChannels';
import {WalletProvider} from '../../utils/walletPass';
import {isAppleWalletConfigured} from '../appleWallet/pass.server';
import {locale, timeZone} from '../../utils/dateUtils';

/**
 * The `/crewcard` slash command: issues an Apple Wallet CrewCard to the calling
 * Slack user, valid until the day after the next Kulturspektakel, and replies
 * (ephemerally) with the same link a physical card carries. No Wallet pass is
 * generated yet. Like any assignment, it suspends the user's other cards.
 */
export async function handleCrewCardCommand(
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const userId = String(form.get('user_id') ?? '');

  const now = new Date();
  const validity = walletCardValidity(await nextKulturspektakel(now), now);
  if (!validity.ok) {
    return Response.json({
      text: `⚠️ CrewCard wurde nicht erstellt: ${validity.error}`,
    });
  }

  const slackUser = await fetchUser(userId);
  if (!slackUser) {
    throw new Error('Slack user not found');
  }
  const viewer = await upsertViewer(slackUser);

  const cardId = newWalletCardId();
  const {suspendedCards} = await assignCrewCardToHolder({
    cardId,
    holder: {viewerId: viewer.id},
    create: {
      cardType: CrewCardType.APPLE_WALLET,
      validUntil: validity.validUntil,
      walletAuthToken: newWalletAuthToken(),
    },
  });

  // With Wallet set up, the link also hands out the pass for its first
  // minutes (see the crew card page); otherwise it's just the card link.
  const walletEnabled = isAppleWalletConfigured();
  const url = `https://kult.cash/$c/${encodeCrewCardPayload(cardId, validity.validUntilEpoch)}${walletEnabled ? `?wallet=${WalletProvider.apple}` : ''}`;
  const lastDay = subDays(validity.validUntil, 1).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });

  const deactivated = suspendedCards.map(({cardType}) =>
    cardType === CrewCardType.PHYSICAL ? 'physische ' : 'bisherige Wallet-',
  );

  // The channel's record of every card, like the enrollment message for
  // physical cards. A failed post doesn't fail the command: the card exists.
  const formattedId = [...cardId]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
  let channelText = `<@${userId}> hat sich die Wallet-CrewCard \`${formattedId}\` erstellt. Gültig bis einschließlich ${lastDay}.`;
  for (const kind of deactivated) {
    channelText += `\nDie ${kind}CrewCard für diese Person wurde deaktiviert.`;
  }
  await sendMessage({channel: SlackChannel.crewcards, text: channelText}).catch(
    (e) => console.error('[crewcard] #crewcards post failed', e),
  );

  let text = `Deine CrewCard ist gültig bis einschließlich ${lastDay}: ${url}`;
  if (walletEnabled) {
    text +=
      '\nÖffne den Link innerhalb von 5 Minuten auf deinem iPhone, um die CrewCard zu Apple Wallet hinzuzufügen.';
  }
  for (const kind of deactivated) {
    text += `\nDeine ${kind}CrewCard wurde deaktiviert.`;
  }
  return Response.json({text});
}
