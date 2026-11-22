// The CrewCard info: shown in the dialog on the card pages (CrewCardInfo.tsx)
// and in the `/crewcard` reply when a wallet pass is issued
// (src/server/slack/crewCard.ts). Client-safe.

export const CREW_CARD_INFO_TITLE = 'Wichtige Info';

/** The info as bullet points, each made of plain and emphasized parts. */
export const CREW_CARD_INFO: Array<Array<{text: string; strong?: boolean}>> = [
  [
    {
      text: 'Egal ob du etwas für dich, deine Helfer:innen, Bands oder andere Orgas holst, alles was du holst ',
    },
    {text: 'muss', strong: true},
    {text: ' auf deine CrewCard gebucht werden!'},
  ],
  [
    {
      text: 'Für deine Statistik kannst du auf deiner CrewCard-Seite im Nachhinein einzelne Buchungen als "nicht für mich" markieren.',
    },
  ],
];

/** The info as Slack mrkdwn: the title and a bullet list, emphasis in bold. */
export function crewCardInfoMrkdwn(): string {
  const bullets = CREW_CARD_INFO.map(
    (parts) =>
      `• ${parts.map(({text, strong}) => (strong ? `*${text}*` : text)).join('')}`,
  );
  return [`*${CREW_CARD_INFO_TITLE}*`, ...bullets].join('\n');
}
