// The database's enums, as plain `as const` objects plus a union type of the
// same name, shaped like the ones Prisma generated. Client-safe (no ORM
// runtime): the browser imports these, and `src/server/db/schema.ts` builds its
// `pgEnum`s from them. Adding a value: change it here (and, until Prisma is
// gone, in prisma/schema.prisma), then migrate.

export const BandRepertoire = {
  ExclusivelyOwnSongs: 'ExclusivelyOwnSongs',
  MostlyOwnSongs: 'MostlyOwnSongs',
  MostlyCoverSongs: 'MostlyCoverSongs',
  ExclusivelyCoverSongs: 'ExclusivelyCoverSongs',
} as const;
export type BandRepertoire =
  (typeof BandRepertoire)[keyof typeof BandRepertoire];

export const CardTransactionType = {
  TopUp: 'TopUp',
  Charge: 'Charge',
  Cashout: 'Cashout',
  Repair: 'Repair',
  Donation: 'Donation',
} as const;
export type CardTransactionType =
  (typeof CardTransactionType)[keyof typeof CardTransactionType];

export const DemoEmbedType = {
  Unresolvable: 'Unresolvable',
  YouTubeVideo: 'YouTubeVideo',
  YouTubePlaylist: 'YouTubePlaylist',
  BandcampAlbum: 'BandcampAlbum',
  BandcampTrack: 'BandcampTrack',
  SoundcloudUrl: 'SoundcloudUrl',
  SpotifyTrack: 'SpotifyTrack',
  SpotifyArtist: 'SpotifyArtist',
  SpotifyAlbum: 'SpotifyAlbum',
} as const;
export type DemoEmbedType = (typeof DemoEmbedType)[keyof typeof DemoEmbedType];

export const DeviceType = {
  CONTACTLESS_TERMINAL: 'CONTACTLESS_TERMINAL',
  IPAD: 'IPAD',
  NOISE_MONITOR: 'NOISE_MONITOR',
} as const;
export type DeviceType = (typeof DeviceType)[keyof typeof DeviceType];

export const DietType = {
  VEGETARIAN: 'VEGETARIAN',
  VEGAN: 'VEGAN',
} as const;
export type DietType = (typeof DietType)[keyof typeof DietType];

export const DonationSource = {
  Stripe: 'Stripe',
  Manual: 'Manual',
  Membership: 'Membership',
  Other: 'Other',
} as const;
export type DonationSource =
  (typeof DonationSource)[keyof typeof DonationSource];

export const EventType = {
  Kulturspektakel: 'Kulturspektakel',
  Other: 'Other',
  Locker: 'Locker',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const GenreCategory = {
  Rock: 'Rock',
  Pop: 'Pop',
  Indie: 'Indie',
  Reggae_Ska: 'Reggae_Ska',
  Blues_Funk_Jazz_Soul: 'Blues_Funk_Jazz_Soul',
  Folk_SingerSongwriter_Country: 'Folk_SingerSongwriter_Country',
  Elektro_HipHop: 'Elektro_HipHop',
  Hardrock_Metal_Punk: 'Hardrock_Metal_Punk',
  Other: 'Other',
  DJ: 'DJ',
} as const;
export type GenreCategory = (typeof GenreCategory)[keyof typeof GenreCategory];

export const HeardAboutBookingFrom = {
  BYon: 'BYon',
  Newspaper: 'Newspaper',
  Friends: 'Friends',
  Website: 'Website',
  Facebook: 'Facebook',
  Instagram: 'Instagram',
} as const;
export type HeardAboutBookingFrom =
  (typeof HeardAboutBookingFrom)[keyof typeof HeardAboutBookingFrom];

export const MinimumAge = {
  NONE: 'NONE',
  AGE_16: 'AGE_16',
  AGE_18: 'AGE_18',
} as const;
export type MinimumAge = (typeof MinimumAge)[keyof typeof MinimumAge];

export const NoiseTagType = {
  IGNORE: 'IGNORE',
  COMMENT: 'COMMENT',
} as const;
export type NoiseTagType = (typeof NoiseTagType)[keyof typeof NoiseTagType];

export const NonceRequestStatus = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
} as const;
export type NonceRequestStatus =
  (typeof NonceRequestStatus)[keyof typeof NonceRequestStatus];

export const OrderPayment = {
  CASH: 'CASH',
  BON: 'BON',
  SUM_UP: 'SUM_UP',
  VOUCHER: 'VOUCHER',
  FREE_CREW: 'FREE_CREW',
  FREE_BAND: 'FREE_BAND',
  KULT_CARD: 'KULT_CARD',
} as const;
export type OrderPayment = (typeof OrderPayment)[keyof typeof OrderPayment];

export const PreviouslyPlayed = {
  Yes: 'Yes',
  OtherFormation: 'OtherFormation',
  No: 'No',
} as const;
export type PreviouslyPlayed =
  (typeof PreviouslyPlayed)[keyof typeof PreviouslyPlayed];
