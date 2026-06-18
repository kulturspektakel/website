/**
 * Single source of truth for the Slack channel IDs we post to. Add new
 * channels here rather than hardcoding IDs in individual route handlers.
 */
export enum SlackChannel {
  dev = 'C93K75X61',
  bandbewerbungen = 'C3U99AB54',
  wiki = 'C03F5E07Z',
  booking = 'C3KKL3727',
  vorstand = 'G03HP9QM2',
  dj = 'C0491HCU5G9',
  lager = 'C03LJF6P36E',
  bookingmails = 'C06M4CM6D99',
  infomails = 'C08CGJ5BLAF',
  crewcards = 'C0965QS6763',
  zuschuesse = 'C030FV86XKR',
  // TODO: replace with the real awareness channel ID (Slack → channel → "Copy channel ID")
  awareness = 'CHANGE_ME_AWARENESS',
}
