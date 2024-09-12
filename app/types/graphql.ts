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
  TopUp = 'TopUp',
}

export type Config = {
  __typename?: 'Config';
  board: Board;
  depositValue: Scalars['Int']['output'];
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
  createBandApplication: BandApplication;
  createBandApplicationComment: BandApplication;
  createNonceRequest?: Maybe<Scalars['String']['output']>;
  createOrder: Order;
  deleteBandApplicationComment: BandApplication;
  markBandApplicationContacted: BandApplication;
  nonceFromRequest?: Maybe<Scalars['String']['output']>;
  rateBandApplication: BandApplication;
  updateBandApplication: BandApplication;
  updateDeviceProductList: Device;
  upsertProductList: ProductList;
};

export type MutationCreateBandApplicationArgs = {
  data: CreateBandApplicationInput;
  eventId: Scalars['ID']['input'];
};

export type MutationCreateBandApplicationCommentArgs = {
  input: BandApplicationCommentInput;
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

export type HeaderFragment = {__typename?: 'Event'; start: Date; end: Date};

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

export type RootQueryVariables = Exact<{[key: string]: never}>;

export type RootQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      node: {
        __typename?: 'Event';
        start: Date;
        end: Date;
        id: string;
        name: string;
        bandApplicationStart?: Date | null;
        bandApplicationEnd?: Date | null;
        djApplicationStart?: Date | null;
        djApplicationEnd?: Date | null;
      };
    }>;
  };
};

export type PageQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type PageQuery = {
  __typename?: 'Query';
  node?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {
        __typename?: 'Page';
        id: string;
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
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type KultCardQueryVariables = Exact<{
  payload: Scalars['String']['input'];
}>;

export type KultCardQuery = {
  __typename?: 'Query';
  cardStatus: {
    __typename?: 'CardStatus';
    cardId: string;
    hasNewerTransactions?: boolean | null;
    balance: number;
    deposit: number;
    recentTransactions?: Array<
      | {
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
        }
      | {
          __typename: 'MissingTransaction';
          numberOfMissingTransactions: number;
          depositBefore: number;
          depositAfter: number;
          balanceBefore: number;
          balanceAfter: number;
        }
    > | null;
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

export type AngebotQueryVariables = Exact<{[key: string]: never}>;

export type AngebotQuery = {
  __typename?: 'Query';
  productLists: Array<{
    __typename?: 'ProductList';
    id: string;
    name: string;
    description?: string | null;
    emoji?: string | null;
  }>;
  food?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {
        __typename?: 'Page';
        id: string;
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
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
  workshops?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {
        __typename?: 'Page';
        id: string;
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
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
  sport?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {
        __typename?: 'Page';
        id: string;
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
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
  kinderkult?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {
        __typename?: 'Page';
        id: string;
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
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type CreateBandApplicationMutationVariables = Exact<{
  eventId: Scalars['ID']['input'];
  data: CreateBandApplicationInput;
}>;

export type CreateBandApplicationMutation = {
  __typename?: 'Mutation';
  createBandApplication: {__typename?: 'BandApplication'; id: string};
};

export type BookingDetailsFragment = {
  __typename?: 'Event';
  id: string;
  name: string;
  start: Date;
  end: Date;
  bandApplicationStart?: Date | null;
  bandApplicationEnd?: Date | null;
  djApplicationStart?: Date | null;
  djApplicationEnd?: Date | null;
};

export type SingleEventQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  num_photos?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SingleEventQuery = {
  __typename?: 'Query';
  event?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {
        __typename?: 'Event';
        name: string;
        location?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        id: string;
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
      }
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {__typename?: 'Page'}
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type EventsOverviewQueryVariables = Exact<{
  cursor?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<EventType>;
  num_photos?: InputMaybe<Scalars['Int']['input']>;
}>;

export type EventsOverviewQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    pageInfo: {__typename?: 'PageInfo'; hasNextPage: boolean};
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      cursor: string;
      node: {
        __typename?: 'Event';
        id: string;
        name: string;
        start: Date;
        end: Date;
        description?: string | null;
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
    }>;
  };
};

export type InfosQueryVariables = Exact<{[key: string]: never}>;

export type InfosQuery = {
  __typename?: 'Query';
  crewCalendar: Array<{
    __typename?: 'VEvent';
    summary: string;
    start: Date;
    end: Date;
    uid: string;
    location?: string | null;
    allDay: boolean;
  }>;
  infos?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {
        __typename?: 'Page';
        id: string;
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
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
  verein?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {
        __typename?: 'Page';
        id: string;
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
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type LineupBandQueryVariables = Exact<{
  eventId: Scalars['ID']['input'];
  slug: Scalars['String']['input'];
}>;

export type LineupBandQuery = {
  __typename?: 'Query';
  bandPlaying?: {
    __typename?: 'BandPlaying';
    name: string;
    shortDescription?: string | null;
    description?: string | null;
    startTime: Date;
    genre?: string | null;
    spotify?: string | null;
    youtube?: string | null;
    website?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    photo?: {
      __typename?: 'PixelImage';
      scaledUri: string;
      width: number;
      height: number;
      copyright?: string | null;
      large: string;
    } | null;
    area: {
      __typename?: 'Area';
      id: string;
      displayName: string;
      themeColor: string;
    };
  } | null;
};

export type LineupBandSitemapQueryVariables = Exact<{[key: string]: never}>;

export type LineupBandSitemapQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      node: {
        __typename?: 'Event';
        id: string;
        bandsPlaying: {
          __typename?: 'EventBandsPlayingConnection';
          edges: Array<{
            __typename?: 'EventBandsPlayingConnectionEdge';
            node: {__typename?: 'BandPlaying'; slug: string};
          }>;
        };
      };
    }>;
  };
};

export type LineupQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type LineupQuery = {
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
        name: string;
        start: Date;
        end: Date;
        bandApplicationStart?: Date | null;
        bandApplicationEnd?: Date | null;
        djApplicationStart?: Date | null;
        djApplicationEnd?: Date | null;
        bandsPlaying: {
          __typename?: 'EventBandsPlayingConnection';
          edges: Array<{
            __typename?: 'EventBandsPlayingConnectionEdge';
            node: {
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
  areas: Array<{__typename?: 'Area'; id: string; displayName: string}>;
};

export type LineupSitemapQueryVariables = Exact<{[key: string]: never}>;

export type LineupSitemapQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      node: {__typename?: 'Event'; id: string};
    }>;
  };
};

export type LineupIndexQueryVariables = Exact<{[key: string]: never}>;

export type LineupIndexQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      node: {__typename?: 'Event'; start: Date};
    }>;
  };
};

export type LineupsQueryVariables = Exact<{[key: string]: never}>;

export type LineupsQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      node: {__typename?: 'Event'; name: string; id: string; start: Date};
    }>;
  };
};

export type NewsPageQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type NewsPageQuery = {
  __typename?: 'Query';
  node?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {__typename?: 'BandPlaying'}
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {
        __typename?: 'News';
        slug: string;
        title: string;
        createdAt: Date;
        content: {
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
        };
      }
    | {__typename?: 'NuclinoPage'}
    | {__typename?: 'Page'}
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type NewsPageSitemapQueryVariables = Exact<{[key: string]: never}>;

export type NewsPageSitemapQuery = {
  __typename?: 'Query';
  news: {
    __typename?: 'QueryNewsConnection';
    edges: Array<{
      __typename?: 'QueryNewsConnectionEdge';
      node: {__typename?: 'News'; id: string};
    }>;
  };
};

export type NewsArchiveQueryVariables = Exact<{
  cursor?: InputMaybe<Scalars['String']['input']>;
}>;

export type NewsArchiveQuery = {
  __typename?: 'Query';
  news: {
    __typename?: 'QueryNewsConnection';
    pageInfo: {__typename?: 'PageInfo'; hasNextPage: boolean};
    edges: Array<{
      __typename?: 'QueryNewsConnectionEdge';
      cursor: string;
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

export type CreateNonceRequestMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type CreateNonceRequestMutation = {
  __typename?: 'Mutation';
  createNonceRequest?: string | null;
};

export type CheckNonceRequestMutationVariables = Exact<{
  nonceRequestId: Scalars['String']['input'];
}>;

export type CheckNonceRequestMutation = {
  __typename?: 'Mutation';
  nonceFromRequest?: string | null;
};

export type PlakateQueryVariables = Exact<{[key: string]: never}>;

export type PlakateQuery = {
  __typename?: 'Query';
  eventsConnection: {
    __typename?: 'QueryEventsConnection';
    pageInfo: {__typename?: 'PageInfo'; hasNextPage: boolean};
    edges: Array<{
      __typename?: 'QueryEventsConnectionEdge';
      cursor: string;
      node: {
        __typename?: 'Event';
        id: string;
        name: string;
        start: Date;
        poster?: {
          __typename?: 'PixelImage';
          width: number;
          height: number;
          copyright?: string | null;
          small: string;
          large: string;
        } | null;
      };
    }>;
  };
};

export type SpeisekarteQueryVariables = Exact<{[key: string]: never}>;

export type SpeisekarteQuery = {
  __typename?: 'Query';
  productLists: Array<{
    __typename?: 'ProductList';
    name: string;
    emoji?: string | null;
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
  }>;
};

export const HeaderFragmentDoc = gql`
  fragment Header on Event {
    start
    end
  }
`;
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
export const BookingDetailsFragmentDoc = gql`
  fragment BookingDetails on Event {
    id
    name
    start
    end
    bandApplicationStart
    bandApplicationEnd
    djApplicationStart
    djApplicationEnd
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
export const RootDocument = gql`
  query Root {
    eventsConnection(first: 1, type: Kulturspektakel) {
      edges {
        node {
          ...Header
          ...BookingDetails
        }
      }
    }
  }
  ${HeaderFragmentDoc}
  ${BookingDetailsFragmentDoc}
`;

/**
 * __useRootQuery__
 *
 * To run a query within a React component, call `useRootQuery` and pass it any options that fit your needs.
 * When your component renders, `useRootQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRootQuery({
 *   variables: {
 *   },
 * });
 */
export function useRootQuery(
  baseOptions?: Apollo.QueryHookOptions<RootQuery, RootQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<RootQuery, RootQueryVariables>(RootDocument, options);
}
export function useRootLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<RootQuery, RootQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<RootQuery, RootQueryVariables>(
    RootDocument,
    options,
  );
}
export function useRootSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<RootQuery, RootQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<RootQuery, RootQueryVariables>(
    RootDocument,
    options,
  );
}
export type RootQueryHookResult = ReturnType<typeof useRootQuery>;
export type RootLazyQueryHookResult = ReturnType<typeof useRootLazyQuery>;
export type RootSuspenseQueryHookResult = ReturnType<
  typeof useRootSuspenseQuery
>;
export type RootQueryResult = Apollo.QueryResult<RootQuery, RootQueryVariables>;
export const PageDocument = gql`
  query Page($id: ID!) {
    node(id: $id) {
      ... on Page {
        id
        ...PageContent
      }
    }
  }
  ${PageContentFragmentDoc}
`;

/**
 * __usePageQuery__
 *
 * To run a query within a React component, call `usePageQuery` and pass it any options that fit your needs.
 * When your component renders, `usePageQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePageQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function usePageQuery(
  baseOptions: Apollo.QueryHookOptions<PageQuery, PageQueryVariables> &
    ({variables: PageQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<PageQuery, PageQueryVariables>(PageDocument, options);
}
export function usePageLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<PageQuery, PageQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<PageQuery, PageQueryVariables>(
    PageDocument,
    options,
  );
}
export function usePageSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<PageQuery, PageQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<PageQuery, PageQueryVariables>(
    PageDocument,
    options,
  );
}
export type PageQueryHookResult = ReturnType<typeof usePageQuery>;
export type PageLazyQueryHookResult = ReturnType<typeof usePageLazyQuery>;
export type PageSuspenseQueryHookResult = ReturnType<
  typeof usePageSuspenseQuery
>;
export type PageQueryResult = Apollo.QueryResult<PageQuery, PageQueryVariables>;
export const KultCardDocument = gql`
  query KultCard($payload: String!) {
    cardStatus(payload: $payload) {
      ...CardFragment
      cardId
      hasNewerTransactions
      recentTransactions {
        ...CardTransaction
      }
    }
  }
  ${CardFragmentFragmentDoc}
  ${CardTransactionFragmentDoc}
`;

/**
 * __useKultCardQuery__
 *
 * To run a query within a React component, call `useKultCardQuery` and pass it any options that fit your needs.
 * When your component renders, `useKultCardQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useKultCardQuery({
 *   variables: {
 *      payload: // value for 'payload'
 *   },
 * });
 */
export function useKultCardQuery(
  baseOptions: Apollo.QueryHookOptions<KultCardQuery, KultCardQueryVariables> &
    ({variables: KultCardQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<KultCardQuery, KultCardQueryVariables>(
    KultCardDocument,
    options,
  );
}
export function useKultCardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    KultCardQuery,
    KultCardQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<KultCardQuery, KultCardQueryVariables>(
    KultCardDocument,
    options,
  );
}
export function useKultCardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<KultCardQuery, KultCardQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<KultCardQuery, KultCardQueryVariables>(
    KultCardDocument,
    options,
  );
}
export type KultCardQueryHookResult = ReturnType<typeof useKultCardQuery>;
export type KultCardLazyQueryHookResult = ReturnType<
  typeof useKultCardLazyQuery
>;
export type KultCardSuspenseQueryHookResult = ReturnType<
  typeof useKultCardSuspenseQuery
>;
export type KultCardQueryResult = Apollo.QueryResult<
  KultCardQuery,
  KultCardQueryVariables
>;
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
export const AngebotDocument = gql`
  query Angebot {
    productLists(activeOnly: true) {
      id
      name
      description
      emoji
    }
    food: node(id: "Page:speisen-getraenke") {
      ... on Page {
        id
        ...PageContent
      }
    }
    workshops: node(id: "Page:workshops") {
      ... on Page {
        id
        ...PageContent
      }
    }
    sport: node(id: "Page:sport") {
      ... on Page {
        id
        ...PageContent
      }
    }
    kinderkult: node(id: "Page:kinderkult") {
      ... on Page {
        id
        ...PageContent
      }
    }
  }
  ${PageContentFragmentDoc}
`;

/**
 * __useAngebotQuery__
 *
 * To run a query within a React component, call `useAngebotQuery` and pass it any options that fit your needs.
 * When your component renders, `useAngebotQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAngebotQuery({
 *   variables: {
 *   },
 * });
 */
export function useAngebotQuery(
  baseOptions?: Apollo.QueryHookOptions<AngebotQuery, AngebotQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<AngebotQuery, AngebotQueryVariables>(
    AngebotDocument,
    options,
  );
}
export function useAngebotLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    AngebotQuery,
    AngebotQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<AngebotQuery, AngebotQueryVariables>(
    AngebotDocument,
    options,
  );
}
export function useAngebotSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<AngebotQuery, AngebotQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<AngebotQuery, AngebotQueryVariables>(
    AngebotDocument,
    options,
  );
}
export type AngebotQueryHookResult = ReturnType<typeof useAngebotQuery>;
export type AngebotLazyQueryHookResult = ReturnType<typeof useAngebotLazyQuery>;
export type AngebotSuspenseQueryHookResult = ReturnType<
  typeof useAngebotSuspenseQuery
>;
export type AngebotQueryResult = Apollo.QueryResult<
  AngebotQuery,
  AngebotQueryVariables
>;
export const CreateBandApplicationDocument = gql`
  mutation CreateBandApplication(
    $eventId: ID!
    $data: CreateBandApplicationInput!
  ) {
    createBandApplication(eventId: $eventId, data: $data) {
      id
    }
  }
`;
export type CreateBandApplicationMutationFn = Apollo.MutationFunction<
  CreateBandApplicationMutation,
  CreateBandApplicationMutationVariables
>;

/**
 * __useCreateBandApplicationMutation__
 *
 * To run a mutation, you first call `useCreateBandApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateBandApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createBandApplicationMutation, { data, loading, error }] = useCreateBandApplicationMutation({
 *   variables: {
 *      eventId: // value for 'eventId'
 *      data: // value for 'data'
 *   },
 * });
 */
export function useCreateBandApplicationMutation(
  baseOptions?: Apollo.MutationHookOptions<
    CreateBandApplicationMutation,
    CreateBandApplicationMutationVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useMutation<
    CreateBandApplicationMutation,
    CreateBandApplicationMutationVariables
  >(CreateBandApplicationDocument, options);
}
export type CreateBandApplicationMutationHookResult = ReturnType<
  typeof useCreateBandApplicationMutation
>;
export type CreateBandApplicationMutationResult =
  Apollo.MutationResult<CreateBandApplicationMutation>;
export type CreateBandApplicationMutationOptions = Apollo.BaseMutationOptions<
  CreateBandApplicationMutation,
  CreateBandApplicationMutationVariables
>;
export const SingleEventDocument = gql`
  query SingleEvent($id: ID!, $num_photos: Int = 100) {
    event: node(id: $id) {
      ... on Event {
        name
        ...EventDetails
        location
        latitude
        longitude
      }
    }
  }
  ${EventDetailsFragmentDoc}
`;

/**
 * __useSingleEventQuery__
 *
 * To run a query within a React component, call `useSingleEventQuery` and pass it any options that fit your needs.
 * When your component renders, `useSingleEventQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSingleEventQuery({
 *   variables: {
 *      id: // value for 'id'
 *      num_photos: // value for 'num_photos'
 *   },
 * });
 */
export function useSingleEventQuery(
  baseOptions: Apollo.QueryHookOptions<
    SingleEventQuery,
    SingleEventQueryVariables
  > &
    ({variables: SingleEventQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<SingleEventQuery, SingleEventQueryVariables>(
    SingleEventDocument,
    options,
  );
}
export function useSingleEventLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SingleEventQuery,
    SingleEventQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<SingleEventQuery, SingleEventQueryVariables>(
    SingleEventDocument,
    options,
  );
}
export function useSingleEventSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        SingleEventQuery,
        SingleEventQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<SingleEventQuery, SingleEventQueryVariables>(
    SingleEventDocument,
    options,
  );
}
export type SingleEventQueryHookResult = ReturnType<typeof useSingleEventQuery>;
export type SingleEventLazyQueryHookResult = ReturnType<
  typeof useSingleEventLazyQuery
>;
export type SingleEventSuspenseQueryHookResult = ReturnType<
  typeof useSingleEventSuspenseQuery
>;
export type SingleEventQueryResult = Apollo.QueryResult<
  SingleEventQuery,
  SingleEventQueryVariables
>;
export const EventsOverviewDocument = gql`
  query EventsOverview(
    $cursor: String
    $type: EventType
    $num_photos: Int = 15
  ) {
    eventsConnection(type: $type, first: 10, after: $cursor) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          name
          start
          end
          ...EventDetails
        }
      }
    }
  }
  ${EventDetailsFragmentDoc}
`;

/**
 * __useEventsOverviewQuery__
 *
 * To run a query within a React component, call `useEventsOverviewQuery` and pass it any options that fit your needs.
 * When your component renders, `useEventsOverviewQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useEventsOverviewQuery({
 *   variables: {
 *      cursor: // value for 'cursor'
 *      type: // value for 'type'
 *      num_photos: // value for 'num_photos'
 *   },
 * });
 */
export function useEventsOverviewQuery(
  baseOptions?: Apollo.QueryHookOptions<
    EventsOverviewQuery,
    EventsOverviewQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<EventsOverviewQuery, EventsOverviewQueryVariables>(
    EventsOverviewDocument,
    options,
  );
}
export function useEventsOverviewLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    EventsOverviewQuery,
    EventsOverviewQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<EventsOverviewQuery, EventsOverviewQueryVariables>(
    EventsOverviewDocument,
    options,
  );
}
export function useEventsOverviewSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        EventsOverviewQuery,
        EventsOverviewQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<
    EventsOverviewQuery,
    EventsOverviewQueryVariables
  >(EventsOverviewDocument, options);
}
export type EventsOverviewQueryHookResult = ReturnType<
  typeof useEventsOverviewQuery
>;
export type EventsOverviewLazyQueryHookResult = ReturnType<
  typeof useEventsOverviewLazyQuery
>;
export type EventsOverviewSuspenseQueryHookResult = ReturnType<
  typeof useEventsOverviewSuspenseQuery
>;
export type EventsOverviewQueryResult = Apollo.QueryResult<
  EventsOverviewQuery,
  EventsOverviewQueryVariables
>;
export const InfosDocument = gql`
  query Infos {
    crewCalendar {
      summary
      start
      end
      uid
      location
      allDay
    }
    infos: node(id: "Page:infos") {
      ... on Page {
        id
        ...PageContent
      }
    }
    verein: node(id: "Page:verein") {
      ... on Page {
        id
        ...PageContent
      }
    }
  }
  ${PageContentFragmentDoc}
`;

/**
 * __useInfosQuery__
 *
 * To run a query within a React component, call `useInfosQuery` and pass it any options that fit your needs.
 * When your component renders, `useInfosQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useInfosQuery({
 *   variables: {
 *   },
 * });
 */
export function useInfosQuery(
  baseOptions?: Apollo.QueryHookOptions<InfosQuery, InfosQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<InfosQuery, InfosQueryVariables>(
    InfosDocument,
    options,
  );
}
export function useInfosLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<InfosQuery, InfosQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<InfosQuery, InfosQueryVariables>(
    InfosDocument,
    options,
  );
}
export function useInfosSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<InfosQuery, InfosQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<InfosQuery, InfosQueryVariables>(
    InfosDocument,
    options,
  );
}
export type InfosQueryHookResult = ReturnType<typeof useInfosQuery>;
export type InfosLazyQueryHookResult = ReturnType<typeof useInfosLazyQuery>;
export type InfosSuspenseQueryHookResult = ReturnType<
  typeof useInfosSuspenseQuery
>;
export type InfosQueryResult = Apollo.QueryResult<
  InfosQuery,
  InfosQueryVariables
>;
export const LineupBandDocument = gql`
  query LineupBand($eventId: ID!, $slug: String!) {
    bandPlaying(eventId: $eventId, slug: $slug) {
      name
      shortDescription
      description
      photo {
        scaledUri(width: 600)
        large: scaledUri(width: 1200)
        width
        height
        copyright
      }
      startTime
      area {
        id
        displayName
        themeColor
      }
      genre
      spotify
      youtube
      website
      instagram
      facebook
    }
  }
`;

/**
 * __useLineupBandQuery__
 *
 * To run a query within a React component, call `useLineupBandQuery` and pass it any options that fit your needs.
 * When your component renders, `useLineupBandQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLineupBandQuery({
 *   variables: {
 *      eventId: // value for 'eventId'
 *      slug: // value for 'slug'
 *   },
 * });
 */
export function useLineupBandQuery(
  baseOptions: Apollo.QueryHookOptions<
    LineupBandQuery,
    LineupBandQueryVariables
  > &
    ({variables: LineupBandQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<LineupBandQuery, LineupBandQueryVariables>(
    LineupBandDocument,
    options,
  );
}
export function useLineupBandLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    LineupBandQuery,
    LineupBandQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<LineupBandQuery, LineupBandQueryVariables>(
    LineupBandDocument,
    options,
  );
}
export function useLineupBandSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        LineupBandQuery,
        LineupBandQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<LineupBandQuery, LineupBandQueryVariables>(
    LineupBandDocument,
    options,
  );
}
export type LineupBandQueryHookResult = ReturnType<typeof useLineupBandQuery>;
export type LineupBandLazyQueryHookResult = ReturnType<
  typeof useLineupBandLazyQuery
>;
export type LineupBandSuspenseQueryHookResult = ReturnType<
  typeof useLineupBandSuspenseQuery
>;
export type LineupBandQueryResult = Apollo.QueryResult<
  LineupBandQuery,
  LineupBandQueryVariables
>;
export const LineupBandSitemapDocument = gql`
  query LineupBandSitemap {
    eventsConnection(first: 100, type: Kulturspektakel) {
      edges {
        node {
          id
          bandsPlaying(first: 100) {
            edges {
              node {
                slug
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * __useLineupBandSitemapQuery__
 *
 * To run a query within a React component, call `useLineupBandSitemapQuery` and pass it any options that fit your needs.
 * When your component renders, `useLineupBandSitemapQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLineupBandSitemapQuery({
 *   variables: {
 *   },
 * });
 */
export function useLineupBandSitemapQuery(
  baseOptions?: Apollo.QueryHookOptions<
    LineupBandSitemapQuery,
    LineupBandSitemapQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<
    LineupBandSitemapQuery,
    LineupBandSitemapQueryVariables
  >(LineupBandSitemapDocument, options);
}
export function useLineupBandSitemapLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    LineupBandSitemapQuery,
    LineupBandSitemapQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<
    LineupBandSitemapQuery,
    LineupBandSitemapQueryVariables
  >(LineupBandSitemapDocument, options);
}
export function useLineupBandSitemapSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        LineupBandSitemapQuery,
        LineupBandSitemapQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<
    LineupBandSitemapQuery,
    LineupBandSitemapQueryVariables
  >(LineupBandSitemapDocument, options);
}
export type LineupBandSitemapQueryHookResult = ReturnType<
  typeof useLineupBandSitemapQuery
>;
export type LineupBandSitemapLazyQueryHookResult = ReturnType<
  typeof useLineupBandSitemapLazyQuery
>;
export type LineupBandSitemapSuspenseQueryHookResult = ReturnType<
  typeof useLineupBandSitemapSuspenseQuery
>;
export type LineupBandSitemapQueryResult = Apollo.QueryResult<
  LineupBandSitemapQuery,
  LineupBandSitemapQueryVariables
>;
export const LineupDocument = gql`
  query Lineup($id: ID!) {
    node(id: $id) {
      ... on Event {
        name
        start
        end
        bandsPlaying(first: 100) {
          edges {
            node {
              ...Band
              area {
                id
              }
            }
          }
        }
        bandApplicationStart
        bandApplicationEnd
        djApplicationStart
        djApplicationEnd
      }
    }
    areas {
      id
      displayName
    }
  }
  ${BandFragmentDoc}
`;

/**
 * __useLineupQuery__
 *
 * To run a query within a React component, call `useLineupQuery` and pass it any options that fit your needs.
 * When your component renders, `useLineupQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLineupQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useLineupQuery(
  baseOptions: Apollo.QueryHookOptions<LineupQuery, LineupQueryVariables> &
    ({variables: LineupQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<LineupQuery, LineupQueryVariables>(
    LineupDocument,
    options,
  );
}
export function useLineupLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<LineupQuery, LineupQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<LineupQuery, LineupQueryVariables>(
    LineupDocument,
    options,
  );
}
export function useLineupSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<LineupQuery, LineupQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<LineupQuery, LineupQueryVariables>(
    LineupDocument,
    options,
  );
}
export type LineupQueryHookResult = ReturnType<typeof useLineupQuery>;
export type LineupLazyQueryHookResult = ReturnType<typeof useLineupLazyQuery>;
export type LineupSuspenseQueryHookResult = ReturnType<
  typeof useLineupSuspenseQuery
>;
export type LineupQueryResult = Apollo.QueryResult<
  LineupQuery,
  LineupQueryVariables
>;
export const LineupSitemapDocument = gql`
  query LineupSitemap {
    eventsConnection(first: 100, type: Kulturspektakel) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

/**
 * __useLineupSitemapQuery__
 *
 * To run a query within a React component, call `useLineupSitemapQuery` and pass it any options that fit your needs.
 * When your component renders, `useLineupSitemapQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLineupSitemapQuery({
 *   variables: {
 *   },
 * });
 */
export function useLineupSitemapQuery(
  baseOptions?: Apollo.QueryHookOptions<
    LineupSitemapQuery,
    LineupSitemapQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<LineupSitemapQuery, LineupSitemapQueryVariables>(
    LineupSitemapDocument,
    options,
  );
}
export function useLineupSitemapLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    LineupSitemapQuery,
    LineupSitemapQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<LineupSitemapQuery, LineupSitemapQueryVariables>(
    LineupSitemapDocument,
    options,
  );
}
export function useLineupSitemapSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        LineupSitemapQuery,
        LineupSitemapQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<
    LineupSitemapQuery,
    LineupSitemapQueryVariables
  >(LineupSitemapDocument, options);
}
export type LineupSitemapQueryHookResult = ReturnType<
  typeof useLineupSitemapQuery
>;
export type LineupSitemapLazyQueryHookResult = ReturnType<
  typeof useLineupSitemapLazyQuery
>;
export type LineupSitemapSuspenseQueryHookResult = ReturnType<
  typeof useLineupSitemapSuspenseQuery
>;
export type LineupSitemapQueryResult = Apollo.QueryResult<
  LineupSitemapQuery,
  LineupSitemapQueryVariables
>;
export const LineupIndexDocument = gql`
  query LineupIndex {
    eventsConnection(first: 1, hasBandsPlaying: true, type: Kulturspektakel) {
      edges {
        node {
          start
        }
      }
    }
  }
`;

/**
 * __useLineupIndexQuery__
 *
 * To run a query within a React component, call `useLineupIndexQuery` and pass it any options that fit your needs.
 * When your component renders, `useLineupIndexQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLineupIndexQuery({
 *   variables: {
 *   },
 * });
 */
export function useLineupIndexQuery(
  baseOptions?: Apollo.QueryHookOptions<
    LineupIndexQuery,
    LineupIndexQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<LineupIndexQuery, LineupIndexQueryVariables>(
    LineupIndexDocument,
    options,
  );
}
export function useLineupIndexLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    LineupIndexQuery,
    LineupIndexQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<LineupIndexQuery, LineupIndexQueryVariables>(
    LineupIndexDocument,
    options,
  );
}
export function useLineupIndexSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        LineupIndexQuery,
        LineupIndexQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<LineupIndexQuery, LineupIndexQueryVariables>(
    LineupIndexDocument,
    options,
  );
}
export type LineupIndexQueryHookResult = ReturnType<typeof useLineupIndexQuery>;
export type LineupIndexLazyQueryHookResult = ReturnType<
  typeof useLineupIndexLazyQuery
>;
export type LineupIndexSuspenseQueryHookResult = ReturnType<
  typeof useLineupIndexSuspenseQuery
>;
export type LineupIndexQueryResult = Apollo.QueryResult<
  LineupIndexQuery,
  LineupIndexQueryVariables
>;
export const LineupsDocument = gql`
  query Lineups {
    eventsConnection(type: Kulturspektakel, hasBandsPlaying: true, first: 100) {
      edges {
        node {
          name
          id
          start
        }
      }
    }
  }
`;

/**
 * __useLineupsQuery__
 *
 * To run a query within a React component, call `useLineupsQuery` and pass it any options that fit your needs.
 * When your component renders, `useLineupsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLineupsQuery({
 *   variables: {
 *   },
 * });
 */
export function useLineupsQuery(
  baseOptions?: Apollo.QueryHookOptions<LineupsQuery, LineupsQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<LineupsQuery, LineupsQueryVariables>(
    LineupsDocument,
    options,
  );
}
export function useLineupsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    LineupsQuery,
    LineupsQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<LineupsQuery, LineupsQueryVariables>(
    LineupsDocument,
    options,
  );
}
export function useLineupsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<LineupsQuery, LineupsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<LineupsQuery, LineupsQueryVariables>(
    LineupsDocument,
    options,
  );
}
export type LineupsQueryHookResult = ReturnType<typeof useLineupsQuery>;
export type LineupsLazyQueryHookResult = ReturnType<typeof useLineupsLazyQuery>;
export type LineupsSuspenseQueryHookResult = ReturnType<
  typeof useLineupsSuspenseQuery
>;
export type LineupsQueryResult = Apollo.QueryResult<
  LineupsQuery,
  LineupsQueryVariables
>;
export const NewsPageDocument = gql`
  query NewsPage($id: ID!) {
    node(id: $id) {
      ... on News {
        ...Article
        content {
          plainText
        }
      }
    }
  }
  ${ArticleFragmentDoc}
`;

/**
 * __useNewsPageQuery__
 *
 * To run a query within a React component, call `useNewsPageQuery` and pass it any options that fit your needs.
 * When your component renders, `useNewsPageQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNewsPageQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useNewsPageQuery(
  baseOptions: Apollo.QueryHookOptions<NewsPageQuery, NewsPageQueryVariables> &
    ({variables: NewsPageQueryVariables; skip?: boolean} | {skip: boolean}),
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<NewsPageQuery, NewsPageQueryVariables>(
    NewsPageDocument,
    options,
  );
}
export function useNewsPageLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    NewsPageQuery,
    NewsPageQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<NewsPageQuery, NewsPageQueryVariables>(
    NewsPageDocument,
    options,
  );
}
export function useNewsPageSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<NewsPageQuery, NewsPageQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<NewsPageQuery, NewsPageQueryVariables>(
    NewsPageDocument,
    options,
  );
}
export type NewsPageQueryHookResult = ReturnType<typeof useNewsPageQuery>;
export type NewsPageLazyQueryHookResult = ReturnType<
  typeof useNewsPageLazyQuery
>;
export type NewsPageSuspenseQueryHookResult = ReturnType<
  typeof useNewsPageSuspenseQuery
>;
export type NewsPageQueryResult = Apollo.QueryResult<
  NewsPageQuery,
  NewsPageQueryVariables
>;
export const NewsPageSitemapDocument = gql`
  query NewsPageSitemap {
    news(first: 200) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

/**
 * __useNewsPageSitemapQuery__
 *
 * To run a query within a React component, call `useNewsPageSitemapQuery` and pass it any options that fit your needs.
 * When your component renders, `useNewsPageSitemapQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNewsPageSitemapQuery({
 *   variables: {
 *   },
 * });
 */
export function useNewsPageSitemapQuery(
  baseOptions?: Apollo.QueryHookOptions<
    NewsPageSitemapQuery,
    NewsPageSitemapQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<NewsPageSitemapQuery, NewsPageSitemapQueryVariables>(
    NewsPageSitemapDocument,
    options,
  );
}
export function useNewsPageSitemapLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    NewsPageSitemapQuery,
    NewsPageSitemapQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<
    NewsPageSitemapQuery,
    NewsPageSitemapQueryVariables
  >(NewsPageSitemapDocument, options);
}
export function useNewsPageSitemapSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        NewsPageSitemapQuery,
        NewsPageSitemapQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<
    NewsPageSitemapQuery,
    NewsPageSitemapQueryVariables
  >(NewsPageSitemapDocument, options);
}
export type NewsPageSitemapQueryHookResult = ReturnType<
  typeof useNewsPageSitemapQuery
>;
export type NewsPageSitemapLazyQueryHookResult = ReturnType<
  typeof useNewsPageSitemapLazyQuery
>;
export type NewsPageSitemapSuspenseQueryHookResult = ReturnType<
  typeof useNewsPageSitemapSuspenseQuery
>;
export type NewsPageSitemapQueryResult = Apollo.QueryResult<
  NewsPageSitemapQuery,
  NewsPageSitemapQueryVariables
>;
export const NewsArchiveDocument = gql`
  query NewsArchive($cursor: String) {
    news(after: $cursor, first: 20) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          ...Article
        }
      }
    }
  }
  ${ArticleFragmentDoc}
`;

/**
 * __useNewsArchiveQuery__
 *
 * To run a query within a React component, call `useNewsArchiveQuery` and pass it any options that fit your needs.
 * When your component renders, `useNewsArchiveQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNewsArchiveQuery({
 *   variables: {
 *      cursor: // value for 'cursor'
 *   },
 * });
 */
export function useNewsArchiveQuery(
  baseOptions?: Apollo.QueryHookOptions<
    NewsArchiveQuery,
    NewsArchiveQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<NewsArchiveQuery, NewsArchiveQueryVariables>(
    NewsArchiveDocument,
    options,
  );
}
export function useNewsArchiveLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    NewsArchiveQuery,
    NewsArchiveQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<NewsArchiveQuery, NewsArchiveQueryVariables>(
    NewsArchiveDocument,
    options,
  );
}
export function useNewsArchiveSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        NewsArchiveQuery,
        NewsArchiveQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<NewsArchiveQuery, NewsArchiveQueryVariables>(
    NewsArchiveDocument,
    options,
  );
}
export type NewsArchiveQueryHookResult = ReturnType<typeof useNewsArchiveQuery>;
export type NewsArchiveLazyQueryHookResult = ReturnType<
  typeof useNewsArchiveLazyQuery
>;
export type NewsArchiveSuspenseQueryHookResult = ReturnType<
  typeof useNewsArchiveSuspenseQuery
>;
export type NewsArchiveQueryResult = Apollo.QueryResult<
  NewsArchiveQuery,
  NewsArchiveQueryVariables
>;
export const CreateNonceRequestDocument = gql`
  mutation CreateNonceRequest($email: String!) {
    createNonceRequest(email: $email)
  }
`;
export type CreateNonceRequestMutationFn = Apollo.MutationFunction<
  CreateNonceRequestMutation,
  CreateNonceRequestMutationVariables
>;

/**
 * __useCreateNonceRequestMutation__
 *
 * To run a mutation, you first call `useCreateNonceRequestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateNonceRequestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createNonceRequestMutation, { data, loading, error }] = useCreateNonceRequestMutation({
 *   variables: {
 *      email: // value for 'email'
 *   },
 * });
 */
export function useCreateNonceRequestMutation(
  baseOptions?: Apollo.MutationHookOptions<
    CreateNonceRequestMutation,
    CreateNonceRequestMutationVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useMutation<
    CreateNonceRequestMutation,
    CreateNonceRequestMutationVariables
  >(CreateNonceRequestDocument, options);
}
export type CreateNonceRequestMutationHookResult = ReturnType<
  typeof useCreateNonceRequestMutation
>;
export type CreateNonceRequestMutationResult =
  Apollo.MutationResult<CreateNonceRequestMutation>;
export type CreateNonceRequestMutationOptions = Apollo.BaseMutationOptions<
  CreateNonceRequestMutation,
  CreateNonceRequestMutationVariables
>;
export const CheckNonceRequestDocument = gql`
  mutation CheckNonceRequest($nonceRequestId: String!) {
    nonceFromRequest(nonceRequestId: $nonceRequestId)
  }
`;
export type CheckNonceRequestMutationFn = Apollo.MutationFunction<
  CheckNonceRequestMutation,
  CheckNonceRequestMutationVariables
>;

/**
 * __useCheckNonceRequestMutation__
 *
 * To run a mutation, you first call `useCheckNonceRequestMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCheckNonceRequestMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [checkNonceRequestMutation, { data, loading, error }] = useCheckNonceRequestMutation({
 *   variables: {
 *      nonceRequestId: // value for 'nonceRequestId'
 *   },
 * });
 */
export function useCheckNonceRequestMutation(
  baseOptions?: Apollo.MutationHookOptions<
    CheckNonceRequestMutation,
    CheckNonceRequestMutationVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useMutation<
    CheckNonceRequestMutation,
    CheckNonceRequestMutationVariables
  >(CheckNonceRequestDocument, options);
}
export type CheckNonceRequestMutationHookResult = ReturnType<
  typeof useCheckNonceRequestMutation
>;
export type CheckNonceRequestMutationResult =
  Apollo.MutationResult<CheckNonceRequestMutation>;
export type CheckNonceRequestMutationOptions = Apollo.BaseMutationOptions<
  CheckNonceRequestMutation,
  CheckNonceRequestMutationVariables
>;
export const PlakateDocument = gql`
  query Plakate {
    eventsConnection(type: Kulturspektakel, first: 50) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          name
          start
          poster {
            small: scaledUri(width: 200)
            large: scaledUri(width: 1600)
            width
            height
            copyright
          }
        }
      }
    }
  }
`;

/**
 * __usePlakateQuery__
 *
 * To run a query within a React component, call `usePlakateQuery` and pass it any options that fit your needs.
 * When your component renders, `usePlakateQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePlakateQuery({
 *   variables: {
 *   },
 * });
 */
export function usePlakateQuery(
  baseOptions?: Apollo.QueryHookOptions<PlakateQuery, PlakateQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<PlakateQuery, PlakateQueryVariables>(
    PlakateDocument,
    options,
  );
}
export function usePlakateLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    PlakateQuery,
    PlakateQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<PlakateQuery, PlakateQueryVariables>(
    PlakateDocument,
    options,
  );
}
export function usePlakateSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<PlakateQuery, PlakateQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<PlakateQuery, PlakateQueryVariables>(
    PlakateDocument,
    options,
  );
}
export type PlakateQueryHookResult = ReturnType<typeof usePlakateQuery>;
export type PlakateLazyQueryHookResult = ReturnType<typeof usePlakateLazyQuery>;
export type PlakateSuspenseQueryHookResult = ReturnType<
  typeof usePlakateSuspenseQuery
>;
export type PlakateQueryResult = Apollo.QueryResult<
  PlakateQuery,
  PlakateQueryVariables
>;
export const SpeisekarteDocument = gql`
  query Speisekarte {
    productLists(activeOnly: true) {
      name
      emoji
      ...ProductListComponent
    }
  }
  ${ProductListComponentFragmentDoc}
`;

/**
 * __useSpeisekarteQuery__
 *
 * To run a query within a React component, call `useSpeisekarteQuery` and pass it any options that fit your needs.
 * When your component renders, `useSpeisekarteQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSpeisekarteQuery({
 *   variables: {
 *   },
 * });
 */
export function useSpeisekarteQuery(
  baseOptions?: Apollo.QueryHookOptions<
    SpeisekarteQuery,
    SpeisekarteQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<SpeisekarteQuery, SpeisekarteQueryVariables>(
    SpeisekarteDocument,
    options,
  );
}
export function useSpeisekarteLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SpeisekarteQuery,
    SpeisekarteQueryVariables
  >,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<SpeisekarteQuery, SpeisekarteQueryVariables>(
    SpeisekarteDocument,
    options,
  );
}
export function useSpeisekarteSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        SpeisekarteQuery,
        SpeisekarteQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken
      ? baseOptions
      : {...defaultOptions, ...baseOptions};
  return Apollo.useSuspenseQuery<SpeisekarteQuery, SpeisekarteQueryVariables>(
    SpeisekarteDocument,
    options,
  );
}
export type SpeisekarteQueryHookResult = ReturnType<typeof useSpeisekarteQuery>;
export type SpeisekarteLazyQueryHookResult = ReturnType<
  typeof useSpeisekarteLazyQuery
>;
export type SpeisekarteSuspenseQueryHookResult = ReturnType<
  typeof useSpeisekarteSuspenseQuery
>;
export type SpeisekarteQueryResult = Apollo.QueryResult<
  SpeisekarteQuery,
  SpeisekarteQueryVariables
>;
