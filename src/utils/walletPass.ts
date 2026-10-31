// Client-safe: the card page and the pass download route both decide with this.

/** The `?wallet=` values the crew card page understands. */
export const WalletProvider = {
  apple: 'apple',
} as const;
export type WalletProvider =
  (typeof WalletProvider)[keyof typeof WalletProvider];

/**
 * How long after `/crewcard` its link hands out the Wallet pass. The link
 * itself only appears in the user's private Slack reply; the short window keeps
 * a forwarded link from producing more passes. Past it, `?wallet=` is ignored
 * and the link is just the card page.
 */
const WALLET_DOWNLOAD_WINDOW_MS = 5 * 60 * 1000;

export function isWithinWalletDownloadWindow(
  createdAt: Date,
  now = new Date(),
): boolean {
  return now.getTime() - createdAt.getTime() < WALLET_DOWNLOAD_WINDOW_MS;
}
