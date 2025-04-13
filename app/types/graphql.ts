import {gql} from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<T extends {[key: string]: unknown}, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | {[P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never};
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: {input: string; output: string};
  String: {input: string; output: string};
  Boolean: {input: boolean; output: boolean};
  Int: {input: number; output: number};
  Float: {input: number; output: number};
  Date: {input: Date; output: Date};
  DateTime: {input: Date; output: Date};
};

export type Area = Node & {
  __typename?: 'Area';
  bandsPlaying: Array<BandPlaying>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  openingHour: Array<OpeningHour>;
  themeColor: Scalars['String']['output'];
};

export type AreaBandsPlayingArgs = {
  day: Scalars['Date']['input'];
};

export type AreaOpeningHourArgs = {
  day?: InputMaybe<Scalars['Date']['input']>;
};

export type Asset = {
  copyright?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  title?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
  uri: Scalars['String']['output'];
};

export type BandApplication = Node & {
  __typename?: 'BandApplication';
  bandApplicationRating: Array<BandApplicationRating>;
  bandname: Scalars['String']['output'];
  city: Scalars['String']['output'];
  comments: BandApplicationCommentsConnection;
  contactName: Scalars['String']['output'];
  contactPhone: Scalars['String']['output'];
  contactedByViewer?: Maybe<Viewer>;
  createdAt: Scalars['DateTime']['output'];
  demo?: Maybe<Scalars['String']['output']>;
  demoEmbed?: Maybe<Scalars['String']['output']>;
  demoEmbedType?: Maybe<DemoEmbedType>;
  demoEmbedUrl?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  distance?: Maybe<Scalars['Float']['output']>;
  email: Scalars['String']['output'];
  event: Event;
  eventId: Scalars['ID']['output'];
  facebook?: Maybe<Scalars['String']['output']>;
  facebookLikes?: Maybe<Scalars['Int']['output']>;
  genre?: Maybe<Scalars['String']['output']>;
  genreCategory: GenreCategory;
  hasPreviouslyPlayed?: Maybe<PreviouslyPlayed>;
  heardAboutBookingFrom?: Maybe<HeardAboutBookingFrom>;
  id: Scalars['ID']['output'];
  instagram?: Maybe<Scalars['String']['output']>;
  instagramFollower?: Maybe<Scalars['Int']['output']>;
  knowsKultFrom?: Maybe<Scalars['String']['output']>;
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  numberOfArtists?: Maybe<Scalars['Int']['output']>;
  numberOfNonMaleArtists?: Maybe<Scalars['Int']['output']>;
  pastApplications: Array<BandApplication>;
  pastPerformances: Array<BandPlaying>;
  rating?: Maybe<Scalars['Float']['output']>;
  repertoire?: Maybe<BandRepertoireType>;
  spotifyArtist?: Maybe<Scalars['String']['output']>;
  spotifyMonthlyListeners?: Maybe<Scalars['Int']['output']>;
  tags: Array<Scalars['String']['output']>;
  website?: Maybe<Scalars['String']['output']>;
};

export type BandApplicationCommentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type BandApplicationComment = Node & {
  __typename?: 'BandApplicationComment';
  comment: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  user: Viewer;
};

export type BandApplicationCommentInput = {
  bandApplicationId: Scalars['ID']['input'];
  comment: Scalars['String']['input'];
};

export type BandApplicationCommentsConnection = {
  __typename?: 'BandApplicationCommentsConnection';
  edges: Array<BandApplicationCommentsConnectionEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type BandApplicationCommentsConnectionEdge = {
  __typename?: 'BandApplicationCommentsConnectionEdge';
  cursor: Scalars['String']['output'];
  node: BandApplicationComment;
};

export type BandApplicationRating = {
  __typename?: 'BandApplicationRating';
  rating: Scalars['Int']['output'];
  viewer: Viewer;
};

export type BandApplicationUpdateInput = {
  contacted?: InputMaybe<Scalars['Boolean']['input']>;
  instagramFollower?: InputMaybe<Scalars['Int']['input']>;
};

export type BandPlaying = Node & {
  __typename?: 'BandPlaying';
  area: Area;
  description?: Maybe<Scalars['String']['output']>;
  endTime: Scalars['DateTime']['output'];
  event: Event;
  eventId: Scalars['ID']['output'];
  facebook?: Maybe<Scalars['String']['output']>;
  genre?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  instagram?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  photo?: Maybe<PixelImage>;
  shortDescription?: Maybe<Scalars['String']['output']>;
  slug: Scalars['String']['output'];
  soundcloud?: Maybe<Scalars['String']['output']>;
  spotify?: Maybe<Scalars['String']['output']>;
  startTime: Scalars['DateTime']['output'];
  website?: Maybe<Scalars['String']['output']>;
  youtube?: Maybe<Scalars['String']['output']>;
};

export enum BandRepertoireType {
  ExclusivelyCoverSongs = 'ExclusivelyCoverSongs',
  ExclusivelyOwnSongs = 'ExclusivelyOwnSongs',
  MostlyCoverSongs = 'MostlyCoverSongs',
  MostlyOwnSongs = 'MostlyOwnSongs',
}

export type Billable = {
  salesNumbers: Array<SalesNumber>;
};

export type BillableSalesNumbersArgs = {
  after: Scalars['DateTime']['input'];
  before: Scalars['DateTime']['input'];
};

export type Board = {
  __typename?: 'Board';
  chair: Scalars['String']['output'];
  deputy: Scalars['String']['output'];
  deputy2: Scalars['String']['output'];
  observer: Scalars['String']['output'];
  observer2: Scalars['String']['output'];
  secretary: Scalars['String']['output'];
  treasurer: Scalars['String']['output'];
};

export type Card = Node &
  Transactionable & {
    __typename?: 'Card';
    id: Scalars['ID']['output'];
    transactions: CardTransactionConnection;
  };

export type CardTransactionsArgs = {
  after?: InputMaybe<Scalars['DateTime']['input']>;
  before?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<CardTransactionType>;
};

export type CardStatus = {
  __typename?: 'CardStatus';
  balance: Scalars['Int']['output'];
  cardId: Scalars['ID']['output'];
  deposit: Scalars['Int']['output'];
  hasNewerTransactions?: Maybe<Scalars['Boolean']['output']>;
  recentTransactions?: Maybe<Array<Transaction>>;
};

export type CardTransaction = Transaction & {
  __typename?: 'CardTransaction';
  Order?: Maybe<Order>;
  balanceAfter: Scalars['Int']['output'];
  balanceBefore: Scalars['Int']['output'];
  cardId: Scalars['String']['output'];
  clientId: Scalars['String']['output'];
  depositAfter: Scalars['Int']['output'];
  depositBefore: Scalars['Int']['output'];
  deviceTime: Scalars['DateTime']['output'];
  transactionType: CardTransactionType;
};

export type CardTransactionConnection = {
  __typename?: 'CardTransactionConnection';
  /** This includes money made from deposit */
  balanceTotal: Scalars['Int']['output'];
  data: Array<CardTransaction>;
  depositIn: Scalars['Int']['output'];
  depositOut: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
  uniqueCards: Scalars['Int']['output'];
};

export enum CardTransactionType {
  Cashout = 'Cashout',
  Charge = 'Charge',
  Repair = 'Repair',
  TopUp = 'TopUp',
}

export type Config = {
  __typename?: 'Config';
  board: Board;
  depositValue: Scalars['Int']['output'];
  membershipFees: MembershipFees;
};

export type CreateBandApplicationInput = {
  bandname: Scalars['String']['input'];
  city: Scalars['String']['input'];
  contactName: Scalars['String']['input'];
  contactPhone: Scalars['String']['input'];
  demo?: InputMaybe<Scalars['String']['input']>;
  description: Scalars['String']['input'];
  email: Scalars['String']['input'];
  facebook?: InputMaybe<Scalars['String']['input']>;
  genre?: InputMaybe<Scalars['String']['input']>;
  genreCategory: GenreCategory;
  hasPreviouslyPlayed?: InputMaybe<PreviouslyPlayed>;
  heardAboutBookingFrom?: InputMaybe<HeardAboutBookingFrom>;
  instagram?: InputMaybe<Scalars['String']['input']>;
  knowsKultFrom?: InputMaybe<Scalars['String']['input']>;
  numberOfArtists?: InputMaybe<Scalars['Int']['input']>;
  numberOfNonMaleArtists?: InputMaybe<Scalars['Int']['input']>;
  repertoire?: InputMaybe<BandRepertoireType>;
  spotifyArtist?: InputMaybe<Scalars['String']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
};

export enum DemoEmbedType {
  BandcampAlbum = 'BandcampAlbum',
  BandcampTrack = 'BandcampTrack',
  SoundcloudUrl = 'SoundcloudUrl',
  SpotifyAlbum = 'SpotifyAlbum',
  SpotifyArtist = 'SpotifyArtist',
  SpotifyTrack = 'SpotifyTrack',
  Unresolvable = 'Unresolvable',
  YouTubePlaylist = 'YouTubePlaylist',
  YouTubeVideo = 'YouTubeVideo',
}

export type Device = Billable &
  Node &
  Transactionable & {
    __typename?: 'Device';
    id: Scalars['ID']['output'];
    lastSeen?: Maybe<Scalars['DateTime']['output']>;
    productList?: Maybe<ProductList>;
    salesNumbers: Array<SalesNumber>;
    softwareVersion?: Maybe<Scalars['String']['output']>;
    transactions: CardTransactionConnection;
  };

export type DeviceSalesNumbersArgs = {
  after: Scalars['DateTime']['input'];
  before: Scalars['DateTime']['input'];
};

export type DeviceTransactionsArgs = {
  after?: InputMaybe<Scalars['DateTime']['input']>;
  before?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<CardTransactionType>;
};

export enum DeviceType {
  ContactlessTerminal = 'CONTACTLESS_TERMINAL',
  Ipad = 'IPAD',
}

export enum DirectusPixelImageFormat {
  Auto = 'auto',
  Jpg = 'jpg',
  Original = 'original',
  Png = 'png',
  Tiff = 'tiff',
  Webp = 'webp',
}

export type Event = Node & {
  __typename?: 'Event';
  bandApplication: Array<BandApplication>;
  bandApplicationEnd?: Maybe<Scalars['DateTime']['output']>;
  bandApplicationStart?: Maybe<Scalars['DateTime']['output']>;
  bandsPlaying: EventBandsPlayingConnection;
  description?: Maybe<Scalars['String']['output']>;
  djApplicationEnd?: Maybe<Scalars['DateTime']['output']>;
  djApplicationStart?: Maybe<Scalars['DateTime']['output']>;
  end: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  latitude?: Maybe<Scalars['Float']['output']>;
  location?: Maybe<Scalars['String']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  media: EventMediaConnection;
  name: Scalars['String']['output'];
  poster?: Maybe<PixelImage>;
  start: Scalars['DateTime']['output'];
};

export type EventBandsPlayingArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type EventMediaArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

export type EventBandsPlayingConnection = {
  __typename?: 'EventBandsPlayingConnection';
  edges: Array<EventBandsPlayingConnectionEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type EventBandsPlayingConnectionEdge = {
  __typename?: 'EventBandsPlayingConnectionEdge';
  cursor: Scalars['String']['output'];
  node: BandPlaying;
};

export type EventMediaConnection = {
  __typename?: 'EventMediaConnection';
  edges: Array<EventMediaConnectionEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type EventMediaConnectionEdge = {
  __typename?: 'EventMediaConnectionEdge';
  cursor: Scalars['String']['output'];
  node: Asset;
};

export enum EventType {
  Kulturspektakel = 'Kulturspektakel',
  Locker = 'Locker',
  Other = 'Other',
}

export enum GenreCategory {
  BluesFunkJazzSoul = 'Blues_Funk_Jazz_Soul',
  Dj = 'DJ',
  ElektroHipHop = 'Elektro_HipHop',
  FolkSingerSongwriterCountry = 'Folk_SingerSongwriter_Country',
  HardrockMetalPunk = 'Hardrock_Metal_Punk',
  Indie = 'Indie',
  Other = 'Other',
  Pop = 'Pop',
  ReggaeSka = 'Reggae_Ska',
  Rock = 'Rock',
}

export enum HeardAboutBookingFrom {
  BYon = 'BYon',
  Facebook = 'Facebook',
  Friends = 'Friends',
  Instagram = 'Instagram',
  Newspaper = 'Newspaper',
  Website = 'Website',
}

export type HistoricalProduct = Billable & {
  __typename?: 'HistoricalProduct';
  name: Scalars['String']['output'];
  productListId: Scalars['ID']['output'];
  salesNumbers: Array<SalesNumber>;
};

export type HistoricalProductSalesNumbersArgs = {
  after: Scalars['DateTime']['input'];
  before: Scalars['DateTime']['input'];
};

export type MarkdownString = {
  __typename?: 'MarkdownString';
  images: Array<PixelImage>;
  markdown: Scalars['String']['output'];
  plainText: Scalars['String']['output'];
};

export enum Membership {
  Foerderverein = 'foerderverein',
  Kult = 'kult',
}

export type MembershipApplication = {
  accountHolderAddress?: InputMaybe<Scalars['String']['input']>;
  accountHolderCity?: InputMaybe<Scalars['String']['input']>;
  accountHolderName?: InputMaybe<Scalars['String']['input']>;
  address: Scalars['String']['input'];
  city: Scalars['String']['input'];
  email: Scalars['String']['input'];
  iban: Scalars['String']['input'];
  membership: Membership;
  membershipFee: Scalars['Int']['input'];
  membershipType: MembershipType;
  name: Scalars['String']['input'];
};

export type MembershipFee = {
  __typename?: 'MembershipFee';
  reduced: Scalars['Int']['output'];
  regular: Scalars['Int']['output'];
};

export type MembershipFees = {
  __typename?: 'MembershipFees';
  foerderverein: MembershipFee;
  kult: MembershipFee;
};

export enum MembershipType {
  Reduced = 'reduced',
  Regular = 'regular',
  Supporter = 'supporter',
}

export type MissingTransaction = Transaction & {
  __typename?: 'MissingTransaction';
  balanceAfter: Scalars['Int']['output'];
  balanceBefore: Scalars['Int']['output'];
  depositAfter: Scalars['Int']['output'];
  depositBefore: Scalars['Int']['output'];
  numberOfMissingTransactions: Scalars['Int']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addBandApplicationTag: BandApplication;
  createBandApplication: BandApplication;
  createBandApplicationComment: BandApplication;
  createMembershipApplication: Scalars['Boolean']['output'];
  createNonceRequest?: Maybe<Scalars['String']['output']>;
  createOrder: Order;
  deleteBandApplicationComment: BandApplication;
  markBandApplicationContacted: BandApplication;
  nonceFromRequest?: Maybe<Scalars['String']['output']>;
  rateBandApplication: BandApplication;
  removeBandApplicationTag: BandApplication;
  updateBandApplication: BandApplication;
  updateDeviceProductList: Device;
  upsertProductList: ProductList;
};

export type MutationAddBandApplicationTagArgs = {
  bandApplicationId: Scalars['ID']['input'];
  tag: Scalars['String']['input'];
};

export type MutationCreateBandApplicationArgs = {
  data: CreateBandApplicationInput;
  eventId: Scalars['ID']['input'];
};

export type MutationCreateBandApplicationCommentArgs = {
  input: BandApplicationCommentInput;
};

export type MutationCreateMembershipApplicationArgs = {
  data: MembershipApplication;
};

export type MutationCreateNonceRequestArgs = {
  email: Scalars['String']['input'];
};

export type MutationCreateOrderArgs = {
  deposit: Scalars['Int']['input'];
  deviceTime: Scalars['DateTime']['input'];
  payment: OrderPayment;
  products: Array<OrderItemInput>;
};

export type MutationDeleteBandApplicationCommentArgs = {
  id: Scalars['ID']['input'];
};

export type MutationMarkBandApplicationContactedArgs = {
  bandApplicationId: Scalars['ID']['input'];
  contacted: Scalars['Boolean']['input'];
};

export type MutationNonceFromRequestArgs = {
  nonceRequestId: Scalars['String']['input'];
};

export type MutationRateBandApplicationArgs = {
  bandApplicationId: Scalars['ID']['input'];
  rating?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationRemoveBandApplicationTagArgs = {
  bandApplicationId: Scalars['ID']['input'];
  tag: Scalars['String']['input'];
};

export type MutationUpdateBandApplicationArgs = {
  bandApplicationId: Scalars['ID']['input'];
  data?: InputMaybe<BandApplicationUpdateInput>;
};

export type MutationUpdateDeviceProductListArgs = {
  deviceId: Scalars['ID']['input'];
  productListId: Scalars['ID']['input'];
};

export type MutationUpsertProductListArgs = {
  active?: InputMaybe<Scalars['Boolean']['input']>;
  emoji?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  products?: InputMaybe<Array<ProductInput>>;
};

export type News = Node & {
  __typename?: 'News';
  content: MarkdownString;
  createdAt: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  slug: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type Node = {
  id: Scalars['ID']['output'];
};

export type NuclinoPage = Node & {
  __typename?: 'NuclinoPage';
  content: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastUpdatedAt: Scalars['DateTime']['output'];
  lastUpdatedUser: NuclinoUser;
  title: Scalars['String']['output'];
};

export type NuclinoSearchResult = {
  __typename?: 'NuclinoSearchResult';
  highlight?: Maybe<Scalars['String']['output']>;
  page: NuclinoPage;
};

export type NuclinoUser = {
  __typename?: 'NuclinoUser';
  email: Scalars['String']['output'];
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastName: Scalars['String']['output'];
};

export type ObfuscatedBandApplication = {
  __typename?: 'ObfuscatedBandApplication';
  applicationTime: Scalars['DateTime']['output'];
  obfuscatedEmail: Scalars['String']['output'];
};

export type OpeningHour = {
  __typename?: 'OpeningHour';
  endTime: Scalars['DateTime']['output'];
  startTime: Scalars['DateTime']['output'];
};

export type Order = {
  __typename?: 'Order';
  createdAt: Scalars['DateTime']['output'];
  deposit: Scalars['Int']['output'];
  deviceId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['Int']['output'];
  items: Array<OrderItem>;
  payment: OrderPayment;
  total: Scalars['Int']['output'];
};

export type OrderItem = {
  __typename?: 'OrderItem';
  amount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  perUnitPrice: Scalars['Int']['output'];
  productList?: Maybe<ProductList>;
};

export type OrderItemInput = {
  amount: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  perUnitPrice: Scalars['Int']['input'];
  productListId?: InputMaybe<Scalars['Int']['input']>;
};

export enum OrderPayment {
  Bon = 'BON',
  Cash = 'CASH',
  FreeBand = 'FREE_BAND',
  FreeCrew = 'FREE_CREW',
  KultCard = 'KULT_CARD',
  SumUp = 'SUM_UP',
  Voucher = 'VOUCHER',
}

export type Page = Node & {
  __typename?: 'Page';
  bottom?: Maybe<MarkdownString>;
  content?: Maybe<MarkdownString>;
  id: Scalars['ID']['output'];
  left?: Maybe<MarkdownString>;
  right?: Maybe<MarkdownString>;
  title: Scalars['String']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PixelImage = Asset & {
  __typename?: 'PixelImage';
  copyright?: Maybe<Scalars['String']['output']>;
  height: Scalars['Int']['output'];
  id: Scalars['String']['output'];
  scaledUri: Scalars['String']['output'];
  title?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
  uri: Scalars['String']['output'];
  width: Scalars['Int']['output'];
};

export type PixelImageScaledUriArgs = {
  format?: InputMaybe<DirectusPixelImageFormat>;
  height?: InputMaybe<Scalars['Int']['input']>;
  width?: InputMaybe<Scalars['Int']['input']>;
};

export enum PreviouslyPlayed {
  No = 'No',
  OtherFormation = 'OtherFormation',
  Yes = 'Yes',
}

export type Product = Billable &
  Node & {
    __typename?: 'Product';
    additives: Array<ProductAdditives>;
    id: Scalars['ID']['output'];
    name: Scalars['String']['output'];
    price: Scalars['Int']['output'];
    productListId: Scalars['ID']['output'];
    requiresDeposit: Scalars['Boolean']['output'];
    salesNumbers: Array<SalesNumber>;
  };

export type ProductSalesNumbersArgs = {
  after: Scalars['DateTime']['input'];
  before: Scalars['DateTime']['input'];
};

export type ProductAdditives = {
  __typename?: 'ProductAdditives';
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
};

export type ProductInput = {
  additives: Array<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  price: Scalars['Int']['input'];
  requiresDeposit: Scalars['Boolean']['input'];
};

export type ProductList = Billable &
  Node & {
    __typename?: 'ProductList';
    active: Scalars['Boolean']['output'];
    description?: Maybe<Scalars['String']['output']>;
    emoji?: Maybe<Scalars['String']['output']>;
    historicalProducts: Array<HistoricalProduct>;
    id: Scalars['ID']['output'];
    name: Scalars['String']['output'];
    product: Array<Product>;
    salesNumbers: Array<SalesNumber>;
  };

export type ProductListSalesNumbersArgs = {
  after: Scalars['DateTime']['input'];
  before: Scalars['DateTime']['input'];
};

export type Query = {
  __typename?: 'Query';
  areas: Array<Area>;
  bandApplicationTags: Array<Scalars['String']['output']>;
  bandPlaying?: Maybe<BandPlaying>;
  cardStatus: CardStatus;
  checkDuplicateApplication?: Maybe<ObfuscatedBandApplication>;
  config: Config;
  crewCalendar: Array<VEvent>;
  devices: Array<Device>;
  distanceToKult?: Maybe<Scalars['Float']['output']>;
  /** @deprecated Use `eventsConnection` instead. */
  events: Array<Event>;
  eventsConnection: QueryEventsConnection;
  findBandPlaying: Array<BandPlaying>;
  news: QueryNewsConnection;
  node?: Maybe<Node>;
  nodes: Array<Maybe<Node>>;
  nuclinoPages: Array<NuclinoSearchResult>;
  productAdditives: Array<ProductAdditives>;
  productLists: Array<ProductList>;
  spotifyArtist: Array<SpotifyArtist>;
  transactions: Transactions;
  viewer?: Maybe<Viewer>;
};

export type QueryBandPlayingArgs = {
  eventId: Scalars['ID']['input'];
  slug: Scalars['String']['input'];
};

export type QueryCardStatusArgs = {
  payload: Scalars['String']['input'];
};

export type QueryCheckDuplicateApplicationArgs = {
  bandname: Scalars['String']['input'];
  eventId: Scalars['ID']['input'];
};

export type QueryCrewCalendarArgs = {
  includePastEvents?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryDevicesArgs = {
  type?: InputMaybe<DeviceType>;
};

export type QueryDistanceToKultArgs = {
  origin: Scalars['String']['input'];
};

export type QueryEventsArgs = {
  hasBandsPlaying?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<EventType>;
};

export type QueryEventsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  hasBandsPlaying?: InputMaybe<Scalars['Boolean']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<EventType>;
};

export type QueryFindBandPlayingArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};

export type QueryNewsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};

export type QueryNodesArgs = {
  ids: Array<Scalars['ID']['input']>;
};

export type QueryNuclinoPagesArgs = {
  query: Scalars['String']['input'];
};

export type QueryProductAdditivesArgs = {
  type?: InputMaybe<DeviceType>;
};

export type QueryProductListsArgs = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QuerySpotifyArtistArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};

export type QueryEventsConnection = {
  __typename?: 'QueryEventsConnection';
  edges: Array<QueryEventsConnectionEdge>;
  pageInfo: PageInfo;
};

export type QueryEventsConnectionEdge = {
  __typename?: 'QueryEventsConnectionEdge';
  cursor: Scalars['String']['output'];
  node: Event;
};

export type QueryNewsConnection = {
  __typename?: 'QueryNewsConnection';
  edges: Array<QueryNewsConnectionEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type QueryNewsConnectionEdge = {
  __typename?: 'QueryNewsConnectionEdge';
  cursor: Scalars['String']['output'];
  node: News;
};

export type SalesNumber = {
  __typename?: 'SalesNumber';
  count: Scalars['Int']['output'];
  payment: OrderPayment;
  timeSeries: Array<TimeSeries>;
  total: Scalars['Float']['output'];
};

export type SalesNumberTimeSeriesArgs = {
  grouping?: InputMaybe<TimeGrouping>;
};

export type SpotifyArtist = {
  __typename?: 'SpotifyArtist';
  genre?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  image?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
};

export enum TimeGrouping {
  Day = 'Day',
  Hour = 'Hour',
}

export type TimeSeries = {
  __typename?: 'TimeSeries';
  time: Scalars['DateTime']['output'];
  value: Scalars['Int']['output'];
};

export type Transaction = {
  balanceAfter: Scalars['Int']['output'];
  balanceBefore: Scalars['Int']['output'];
  depositAfter: Scalars['Int']['output'];
  depositBefore: Scalars['Int']['output'];
};

export type Transactionable = {
  transactions: CardTransactionConnection;
};

export type TransactionableTransactionsArgs = {
  after?: InputMaybe<Scalars['DateTime']['input']>;
  before?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<CardTransactionType>;
};

export type Transactions = Transactionable & {
  __typename?: 'Transactions';
  transactions: CardTransactionConnection;
};

export type TransactionsTransactionsArgs = {
  after?: InputMaybe<Scalars['DateTime']['input']>;
  before?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<CardTransactionType>;
};

export type VEvent = {
  __typename?: 'VEvent';
  allDay: Scalars['Boolean']['output'];
  comment?: Maybe<Scalars['String']['output']>;
  end: Scalars['DateTime']['output'];
  location?: Maybe<Scalars['String']['output']>;
  start: Scalars['DateTime']['output'];
  summary: Scalars['String']['output'];
  uid: Scalars['String']['output'];
  url?: Maybe<Scalars['String']['output']>;
};

export type Viewer = Node & {
  __typename?: 'Viewer';
  displayName: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  profilePicture?: Maybe<Scalars['String']['output']>;
};

export type MarkdownTextFragment = {
  __typename?: 'MarkdownString';
  markdown: string;
  images: Array<{
    __typename?: 'PixelImage';
    uri: string;
    width: number;
    height: number;
    copyright?: string | null;
    tiny: string;
    small: string;
    large: string;
  }>;
};

export type PageContentFragment = {
  __typename?: 'Page';
  title: string;
  content?: {
    __typename?: 'MarkdownString';
    plainText: string;
    markdown: string;
    images: Array<{
      __typename?: 'PixelImage';
      uri: string;
      width: number;
      height: number;
      copyright?: string | null;
      tiny: string;
      small: string;
      large: string;
    }>;
  } | null;
  left?: {
    __typename?: 'MarkdownString';
    markdown: string;
    images: Array<{
      __typename?: 'PixelImage';
      uri: string;
      width: number;
      height: number;
      copyright?: string | null;
      tiny: string;
      small: string;
      large: string;
    }>;
  } | null;
  right?: {
    __typename?: 'MarkdownString';
    markdown: string;
    images: Array<{
      __typename?: 'PixelImage';
      uri: string;
      width: number;
      height: number;
      copyright?: string | null;
      tiny: string;
      small: string;
      large: string;
    }>;
  } | null;
  bottom?: {
    __typename?: 'MarkdownString';
    markdown: string;
    images: Array<{
      __typename?: 'PixelImage';
      uri: string;
      width: number;
      height: number;
      copyright?: string | null;
      tiny: string;
      small: string;
      large: string;
    }>;
  } | null;
};

export type DistanceQueryVariables = Exact<{
  origin: Scalars['String']['input'];
}>;

export type DistanceQuery = {
  __typename?: 'Query';
  distanceToKult?: number | null;
};

export type DuplicateApplicationWarningQueryVariables = Exact<{
  bandname: Scalars['String']['input'];
  eventId: Scalars['ID']['input'];
}>;

export type DuplicateApplicationWarningQuery = {
  __typename?: 'Query';
  checkDuplicateApplication?: {
    __typename?: 'ObfuscatedBandApplication';
    applicationTime: Date;
    obfuscatedEmail: string;
  } | null;
};

export type SpotifyArtistSearchQueryVariables = Exact<{
  query: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SpotifyArtistSearchQuery = {
  __typename?: 'Query';
  spotifyArtist: Array<{
    __typename?: 'SpotifyArtist';
    id: string;
    name: string;
    genre?: string | null;
    image?: string | null;
  }>;
};

export type EventDetailsFragment = {
  __typename?: 'Event';
  id: string;
  name: string;
  description?: string | null;
  start: Date;
  end: Date;
  poster?: {
    __typename?: 'PixelImage';
    width: number;
    height: number;
    copyright?: string | null;
    thumbnail: string;
    large: string;
  } | null;
  bandsPlaying: {
    __typename?: 'EventBandsPlayingConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'EventBandsPlayingConnectionEdge';
      node: {__typename?: 'BandPlaying'; name: string};
    }>;
  };
  media: {
    __typename?: 'EventMediaConnection';
    totalCount: number;
    pageInfo: {__typename?: 'PageInfo'; hasNextPage: boolean};
    edges: Array<{
      __typename?: 'EventMediaConnectionEdge';
      cursor: string;
      node: {
        __typename?: 'PixelImage';
        width: number;
        height: number;
        id: string;
        thumbnail: string;
        large: string;
      };
    }>;
  };
};

export type EventPhotosFragment = {
  __typename?: 'EventMediaConnection';
  totalCount: number;
  pageInfo: {__typename?: 'PageInfo'; hasNextPage: boolean};
  edges: Array<{
    __typename?: 'EventMediaConnectionEdge';
    cursor: string;
    node: {
      __typename?: 'PixelImage';
      width: number;
      height: number;
      id: string;
      thumbnail: string;
      large: string;
    };
  }>;
};

export type MorePhotosQueryVariables = Exact<{
  event: Scalars['ID']['input'];
  cursor?: InputMaybe<Scalars['String']['input']>;
}>;

export type MorePhotosQuery = {
  __typename?: 'Query';
  node?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {
        __typename?: 'Event';
        media: {
          __typename?: 'EventMediaConnection';
          totalCount: number;
          pageInfo: {__typename?: 'PageInfo'; hasNextPage: boolean};
          edges: Array<{
            __typename?: 'EventMediaConnectionEdge';
            cursor: string;
            node: {
              __typename?: 'PixelImage';
              width: number;
              height: number;
              id: string;
              thumbnail: string;
              large: string;
            };
          }>;
        };
      }
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {__typename?: 'Page'}
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type CardFragmentFragment = {
  __typename?: 'CardStatus';
  balance: number;
  deposit: number;
};

type CardTransaction_CardTransaction_Fragment = {
  __typename: 'CardTransaction';
  deviceTime: Date;
  depositBefore: number;
  depositAfter: number;
  balanceBefore: number;
  balanceAfter: number;
  Order?: {
    __typename?: 'Order';
    items: Array<{
      __typename?: 'OrderItem';
      amount: number;
      name: string;
      productList?: {
        __typename?: 'ProductList';
        emoji?: string | null;
        name: string;
      } | null;
    }>;
  } | null;
};

type CardTransaction_MissingTransaction_Fragment = {
  __typename: 'MissingTransaction';
  numberOfMissingTransactions: number;
  depositBefore: number;
  depositAfter: number;
  balanceBefore: number;
  balanceAfter: number;
};

export type CardTransactionFragment =
  | CardTransaction_CardTransaction_Fragment
  | CardTransaction_MissingTransaction_Fragment;

export type BandFragment = {
  __typename?: 'BandPlaying';
  id: string;
  name: string;
  startTime: Date;
  slug: string;
  genre?: string | null;
  area: {
    __typename?: 'Area';
    id: string;
    displayName: string;
    themeColor: string;
  };
  photo?: {__typename?: 'PixelImage'; scaledUri: string} | null;
};

export type BandSearchQueryVariables = Exact<{
  query: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type BandSearchQuery = {
  __typename?: 'Query';
  findBandPlaying: Array<{
    __typename?: 'BandPlaying';
    id: string;
    name: string;
    startTime: Date;
    slug: string;
  }>;
};

export type ArticleFragment = {
  __typename?: 'News';
  slug: string;
  title: string;
  createdAt: Date;
  content: {
    __typename?: 'MarkdownString';
    markdown: string;
    images: Array<{
      __typename?: 'PixelImage';
      uri: string;
      width: number;
      height: number;
      copyright?: string | null;
      tiny: string;
      small: string;
      large: string;
    }>;
  };
};

export type ProductListComponentFragment = {
  __typename?: 'ProductList';
  description?: string | null;
  product: Array<{
    __typename?: 'Product';
    name: string;
    price: number;
    requiresDeposit: boolean;
    additives: Array<{
      __typename?: 'ProductAdditives';
      displayName: string;
      id: string;
    }>;
  }>;
};

export type DemoQueryVariables = Exact<{[key: string]: never}>;

export type DemoQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      node: {__typename?: 'Event'; id: string; name: string};
    }>;
  };
};

export type NewsQueryVariables = Exact<{[key: string]: never}>;

export type NewsQuery = {
  __typename?: 'Query';
  news: {
    __typename?: 'QueryNewsConnection';
    edges: Array<{
      __typename?: 'QueryNewsConnectionEdge';
      node: {
        __typename?: 'News';
        slug: string;
        title: string;
        createdAt: Date;
        content: {
          __typename?: 'MarkdownString';
          markdown: string;
          images: Array<{
            __typename?: 'PixelImage';
            uri: string;
            width: number;
            height: number;
            copyright?: string | null;
            tiny: string;
            small: string;
            large: string;
          }>;
        };
      };
    }>;
  };
};

export const MarkdownTextFragmentDoc = gql`
  fragment MarkdownText on MarkdownString {
    markdown
    images {
      uri
      tiny: scaledUri(width: 250)
      small: scaledUri(width: 900)
      large: scaledUri(width: 1600)
      width
      height
      copyright
    }
  }
`;
export const PageContentFragmentDoc = gql`
  fragment PageContent on Page {
    title
    content {
      ...MarkdownText
      plainText
    }
    left {
      ...MarkdownText
    }
    right {
      ...MarkdownText
    }
    bottom {
      ...MarkdownText
    }
  }
  ${MarkdownTextFragmentDoc}
`;
export const EventPhotosFragmentDoc = gql`
  fragment EventPhotos on EventMediaConnection {
    totalCount
    pageInfo {
      hasNextPage
    }
    edges {
      cursor
      node {
        id
        ... on PixelImage {
          width
          height
          thumbnail: scaledUri(width: 140)
          large: scaledUri(width: 1200)
        }
      }
    }
  }
`;
export const EventDetailsFragmentDoc = gql`
  fragment EventDetails on Event {
    id
    name
    description
    start
    end
    poster {
      thumbnail: scaledUri(width: 200)
      large: scaledUri(width: 1200)
      width
      height
      copyright
    }
    bandsPlaying(first: 12) {
      totalCount
      edges {
        node {
          name
        }
      }
    }
    media(first: $num_photos) {
      ...EventPhotos
    }
  }
  ${EventPhotosFragmentDoc}
`;
export const CardFragmentFragmentDoc = gql`
  fragment CardFragment on CardStatus {
    balance
    deposit
  }
`;
export const CardTransactionFragmentDoc = gql`
  fragment CardTransaction on Transaction {
    depositBefore
    depositAfter
    balanceBefore
    balanceAfter
    __typename
    ... on CardTransaction {
      deviceTime
      Order {
        items {
          amount
          name
          productList {
            emoji
            name
          }
        }
      }
    }
    ... on MissingTransaction {
      numberOfMissingTransactions
    }
  }
`;
export const BandFragmentDoc = gql`
  fragment Band on BandPlaying {
    id
    name
    startTime
    slug
    area {
      id
      displayName
      themeColor
    }
    genre
    photo {
      scaledUri(height: 200, width: 200)
    }
  }
`;
export const ArticleFragmentDoc = gql`
  fragment Article on News {
    slug
    title
    createdAt
    content {
      ...MarkdownText
    }
  }
  ${MarkdownTextFragmentDoc}
`;
export const ProductListComponentFragmentDoc = gql`
  fragment ProductListComponent on ProductList {
    description
    product {
      additives {
        displayName
        id
      }
      name
      price
      requiresDeposit
    }
  }
`;
export const DistanceDocument = gql`
  query Distance($origin: String!) {
    distanceToKult(origin: $origin)
  }
`;

/**
 * __useDistanceQuery__
 *
 * To run a query within a React component, call `useDistanceQuery` and pass it any options that fit your needs.
 * When your component renders, `useDistanceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDistanceQuery({
 *   variables: {
 *      origin: // value for 'origin'
 *   },
 * });
 */
export function useDistanceQuery(
  baseOptions: Apollo.QueryHookOptions<DistanceQuery, DistanceQueryVariables> &
    ({variables: DistanceQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<DistanceQuery, DistanceQueryVariables>(
    DistanceDocument,
    options,
  );
}
export function useDistanceLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    DistanceQuery,
    DistanceQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<DistanceQuery, DistanceQueryVariables>(
    DistanceDocument,
    options,
  );
}
export function useDistanceSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<DistanceQuery, DistanceQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<DistanceQuery, DistanceQueryVariables>(
    DistanceDocument,
    options,
  );
}
export type DistanceQueryHookResult = ReturnType<typeof useDistanceQuery>;
export type DistanceLazyQueryHookResult = ReturnType<
  typeof useDistanceLazyQuery
>;
export type DistanceSuspenseQueryHookResult = ReturnType<
  typeof useDistanceSuspenseQuery
>;
export type DistanceQueryResult = Apollo.QueryResult<
  DistanceQuery,
  DistanceQueryVariables
>;
export const DuplicateApplicationWarningDocument = gql`
  query DuplicateApplicationWarning($bandname: String!, $eventId: ID!) {
    checkDuplicateApplication(bandname: $bandname, eventId: $eventId) {
      applicationTime
      obfuscatedEmail
    }
  }
`;

/**
 * __useDuplicateApplicationWarningQuery__
 *
 * To run a query within a React component, call `useDuplicateApplicationWarningQuery` and pass it any options that fit your needs.
 * When your component renders, `useDuplicateApplicationWarningQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDuplicateApplicationWarningQuery({
 *   variables: {
 *      bandname: // value for 'bandname'
 *      eventId: // value for 'eventId'
 *   },
 * });
 */
export function useDuplicateApplicationWarningQuery(
  baseOptions: Apollo.QueryHookOptions<
    DuplicateApplicationWarningQuery,
    DuplicateApplicationWarningQueryVariables
  > &
    (
      | {variables: DuplicateApplicationWarningQueryVariables; skip?: boolean}
      | {skip: boolean}
    ),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<
    DuplicateApplicationWarningQuery,
    DuplicateApplicationWarningQueryVariables
  >(DuplicateApplicationWarningDocument, options);
}
export function useDuplicateApplicationWarningLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    DuplicateApplicationWarningQuery,
    DuplicateApplicationWarningQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<
    DuplicateApplicationWarningQuery,
    DuplicateApplicationWarningQueryVariables
  >(DuplicateApplicationWarningDocument, options);
}
export function useDuplicateApplicationWarningSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        DuplicateApplicationWarningQuery,
        DuplicateApplicationWarningQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<
    DuplicateApplicationWarningQuery,
    DuplicateApplicationWarningQueryVariables
  >(DuplicateApplicationWarningDocument, options);
}
export type DuplicateApplicationWarningQueryHookResult = ReturnType<
  typeof useDuplicateApplicationWarningQuery
>;
export type DuplicateApplicationWarningLazyQueryHookResult = ReturnType<
  typeof useDuplicateApplicationWarningLazyQuery
>;
export type DuplicateApplicationWarningSuspenseQueryHookResult = ReturnType<
  typeof useDuplicateApplicationWarningSuspenseQuery
>;
export type DuplicateApplicationWarningQueryResult = Apollo.QueryResult<
  DuplicateApplicationWarningQuery,
  DuplicateApplicationWarningQueryVariables
>;
export const SpotifyArtistSearchDocument = gql`
  query SpotifyArtistSearch($query: String!, $limit: Int = 5) {
    spotifyArtist(query: $query, limit: $limit) {
      id
      name
      genre
      image
    }
  }
`;

/**
 * __useSpotifyArtistSearchQuery__
 *
 * To run a query within a React component, call `useSpotifyArtistSearchQuery` and pass it any options that fit your needs.
 * When your component renders, `useSpotifyArtistSearchQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSpotifyArtistSearchQuery({
 *   variables: {
 *      query: // value for 'query'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSpotifyArtistSearchQuery(
  baseOptions: Apollo.QueryHookOptions<
    SpotifyArtistSearchQuery,
    SpotifyArtistSearchQueryVariables
  > &
    (
      | {variables: SpotifyArtistSearchQueryVariables; skip?: boolean}
      | {skip: boolean}
    ),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<
    SpotifyArtistSearchQuery,
    SpotifyArtistSearchQueryVariables
  >(SpotifyArtistSearchDocument, options);
}
export function useSpotifyArtistSearchLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SpotifyArtistSearchQuery,
    SpotifyArtistSearchQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<
    SpotifyArtistSearchQuery,
    SpotifyArtistSearchQueryVariables
  >(SpotifyArtistSearchDocument, options);
}
export function useSpotifyArtistSearchSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        SpotifyArtistSearchQuery,
        SpotifyArtistSearchQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<
    SpotifyArtistSearchQuery,
    SpotifyArtistSearchQueryVariables
  >(SpotifyArtistSearchDocument, options);
}
export type SpotifyArtistSearchQueryHookResult = ReturnType<
  typeof useSpotifyArtistSearchQuery
>;
export type SpotifyArtistSearchLazyQueryHookResult = ReturnType<
  typeof useSpotifyArtistSearchLazyQuery
>;
export type SpotifyArtistSearchSuspenseQueryHookResult = ReturnType<
  typeof useSpotifyArtistSearchSuspenseQuery
>;
export type SpotifyArtistSearchQueryResult = Apollo.QueryResult<
  SpotifyArtistSearchQuery,
  SpotifyArtistSearchQueryVariables
>;
export const MorePhotosDocument = gql`
  query MorePhotos($event: ID!, $cursor: String) {
    node(id: $event) {
      ... on Event {
        media(after: $cursor, first: 100) {
          ...EventPhotos
        }
      }
    }
  }
  ${EventPhotosFragmentDoc}
`;

/**
 * __useMorePhotosQuery__
 *
 * To run a query within a React component, call `useMorePhotosQuery` and pass it any options that fit your needs.
 * When your component renders, `useMorePhotosQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMorePhotosQuery({
 *   variables: {
 *      event: // value for 'event'
 *      cursor: // value for 'cursor'
 *   },
 * });
 */
export function useMorePhotosQuery(
  baseOptions: Apollo.QueryHookOptions<
    MorePhotosQuery,
    MorePhotosQueryVariables
  > &
    ({variables: MorePhotosQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<MorePhotosQuery, MorePhotosQueryVariables>(
    MorePhotosDocument,
    options,
  );
}
export function useMorePhotosLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    MorePhotosQuery,
    MorePhotosQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<MorePhotosQuery, MorePhotosQueryVariables>(
    MorePhotosDocument,
    options,
  );
}
export function useMorePhotosSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        MorePhotosQuery,
        MorePhotosQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<MorePhotosQuery, MorePhotosQueryVariables>(
    MorePhotosDocument,
    options,
  );
}
export type MorePhotosQueryHookResult = ReturnType<typeof useMorePhotosQuery>;
export type MorePhotosLazyQueryHookResult = ReturnType<
  typeof useMorePhotosLazyQuery
>;
export type MorePhotosSuspenseQueryHookResult = ReturnType<
  typeof useMorePhotosSuspenseQuery
>;
export type MorePhotosQueryResult = Apollo.QueryResult<
  MorePhotosQuery,
  MorePhotosQueryVariables
>;
export const BandSearchDocument = gql`
  query BandSearch($query: String!, $limit: Int = 5) {
    findBandPlaying(query: $query, limit: $limit) {
      id
      name
      startTime
      slug
    }
  }
`;

/**
 * __useBandSearchQuery__
 *
 * To run a query within a React component, call `useBandSearchQuery` and pass it any options that fit your needs.
 * When your component renders, `useBandSearchQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useBandSearchQuery({
 *   variables: {
 *      query: // value for 'query'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useBandSearchQuery(
  baseOptions: Apollo.QueryHookOptions<
    BandSearchQuery,
    BandSearchQueryVariables
  > &
    ({variables: BandSearchQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<BandSearchQuery, BandSearchQueryVariables>(
    BandSearchDocument,
    options,
  );
}
export function useBandSearchLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    BandSearchQuery,
    BandSearchQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<BandSearchQuery, BandSearchQueryVariables>(
    BandSearchDocument,
    options,
  );
}
export function useBandSearchSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        BandSearchQuery,
        BandSearchQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<BandSearchQuery, BandSearchQueryVariables>(
    BandSearchDocument,
    options,
  );
}
export type BandSearchQueryHookResult = ReturnType<typeof useBandSearchQuery>;
export type BandSearchLazyQueryHookResult = ReturnType<
  typeof useBandSearchLazyQuery
>;
export type BandSearchSuspenseQueryHookResult = ReturnType<
  typeof useBandSearchSuspenseQuery
>;
export type BandSearchQueryResult = Apollo.QueryResult<
  BandSearchQuery,
  BandSearchQueryVariables
>;
export const DemoDocument = gql`
  query Demo {
    eventsConnection(first: 1, type: Kulturspektakel) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

/**
 * __useDemoQuery__
 *
 * To run a query within a React component, call `useDemoQuery` and pass it any options that fit your needs.
 * When your component renders, `useDemoQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDemoQuery({
 *   variables: {
 *   },
 * });
 */
export function useDemoQuery(
  baseOptions?: Apollo.QueryHookOptions<DemoQuery, DemoQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<DemoQuery, DemoQueryVariables>(DemoDocument, options);
}
export function useDemoLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<DemoQuery, DemoQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<DemoQuery, DemoQueryVariables>(
    DemoDocument,
    options,
  );
}
export function useDemoSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<DemoQuery, DemoQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<DemoQuery, DemoQueryVariables>(
    DemoDocument,
    options,
  );
}
export type DemoQueryHookResult = ReturnType<typeof useDemoQuery>;
export type DemoLazyQueryHookResult = ReturnType<typeof useDemoLazyQuery>;
export type DemoSuspenseQueryHookResult = ReturnType<
  typeof useDemoSuspenseQuery
>;
export type DemoQueryResult = Apollo.QueryResult<DemoQuery, DemoQueryVariables>;
export const NewsDocument = gql`
  query News {
    news(first: 10) {
      edges {
        node {
          ...Article
        }
      }
    }
  }
  ${ArticleFragmentDoc}
`;

/**
 * __useNewsQuery__
 *
 * To run a query within a React component, call `useNewsQuery` and pass it any options that fit your needs.
 * When your component renders, `useNewsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNewsQuery({
 *   variables: {
 *   },
 * });
 */
export function useNewsQuery(
  baseOptions?: Apollo.QueryHookOptions<NewsQuery, NewsQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<NewsQuery, NewsQueryVariables>(NewsDocument, options);
}
export function useNewsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<NewsQuery, NewsQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<NewsQuery, NewsQueryVariables>(
    NewsDocument,
    options,
  );
}
export function useNewsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<NewsQuery, NewsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<NewsQuery, NewsQueryVariables>(
    NewsDocument,
    options,
  );
}
export type NewsQueryHookResult = ReturnType<typeof useNewsQuery>;
export type NewsLazyQueryHookResult = ReturnType<typeof useNewsLazyQuery>;
export type NewsSuspenseQueryHookResult = ReturnType<
  typeof useNewsSuspenseQuery
>;
export type NewsQueryResult = Apollo.QueryResult<NewsQuery, NewsQueryVariables>;
