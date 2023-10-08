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
  Order: Array<Order>;
  balanceAfter: Scalars['Int']['output'];
  balanceBefore: Scalars['Int']['output'];
  cardId: Scalars['String']['output'];
  clientId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
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
  createOrder: Order;
  deleteBandApplicationComment: BandApplication;
  markBandApplicationContacted: BandApplication;
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
  content: Scalars['String']['output'];
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
  bottom?: Maybe<Scalars['String']['output']>;
  content?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  left?: Maybe<Scalars['String']['output']>;
  right?: Maybe<Scalars['String']['output']>;
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
  devices: Array<Device>;
  distanceToKult?: Maybe<Scalars['Float']['output']>;
  events: Array<Event>;
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

export type QueryDevicesArgs = {
  type?: InputMaybe<DeviceType>;
};

export type QueryDistanceToKultArgs = {
  origin: Scalars['String']['input'];
};

export type QueryEventsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
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

export type Viewer = Node & {
  __typename?: 'Viewer';
  displayName: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  profilePicture?: Maybe<Scalars['String']['output']>;
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

export type StageSelectorFragment = {
  __typename?: 'Query';
  areas: Array<{__typename?: 'Area'; id: string; displayName: string}>;
};

export type ArticleFragment = {
  __typename?: 'News';
  slug: string;
  title: string;
  createdAt: Date;
  content: string;
};

export type ArticleHeadFragment = {
  __typename?: 'News';
  slug: string;
  title: string;
  createdAt: Date;
};

export type ProductListComponentFragment = {
  __typename?: 'ProductList';
  description?: string | null;
  name: string;
  emoji?: string | null;
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
        content?: string | null;
        left?: string | null;
        right?: string | null;
        bottom?: string | null;
      }
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
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
        content: string;
      };
    }>;
  };
};

export type CreateBandApplicationMutationVariables = Exact<{
  eventId: Scalars['ID']['input'];
  data: CreateBandApplicationInput;
}>;

export type CreateBandApplicationMutation = {
  __typename?: 'Mutation';
  createBandApplication: {__typename?: 'BandApplication'; id: string};
};

export type ThanksQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type ThanksQuery = {
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
        bandApplicationEnd?: Date | null;
        djApplicationEnd?: Date | null;
      }
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {__typename?: 'Page'}
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type EventQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type EventQuery = {
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
      }
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {__typename?: 'Page'}
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type LineupBandQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type LineupBandQuery = {
  __typename?: 'Query';
  node?:
    | {__typename?: 'Area'}
    | {__typename?: 'BandApplication'}
    | {__typename?: 'BandApplicationComment'}
    | {
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
        } | null;
        area: {__typename?: 'Area'; displayName: string; themeColor: string};
      }
    | {__typename?: 'Card'}
    | {__typename?: 'Device'}
    | {__typename?: 'Event'}
    | {__typename?: 'News'}
    | {__typename?: 'NuclinoPage'}
    | {__typename?: 'Page'}
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
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
        content: string;
      }
    | {__typename?: 'NuclinoPage'}
    | {__typename?: 'Page'}
    | {__typename?: 'Product'}
    | {__typename?: 'ProductList'}
    | {__typename?: 'Viewer'}
    | null;
};

export type SpeisekarteQueryVariables = Exact<{[key: string]: never}>;

export type SpeisekarteQuery = {
  __typename?: 'Query';
  productLists: Array<{
    __typename?: 'ProductList';
    description?: string | null;
    name: string;
    emoji?: string | null;
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
export const StageSelectorFragmentDoc = gql`
  fragment StageSelector on Query {
    areas {
      id
      displayName
    }
  }
`;
export const ArticleHeadFragmentDoc = gql`
  fragment ArticleHead on News {
    slug
    title
    createdAt
  }
`;
export const ArticleFragmentDoc = gql`
  fragment Article on News {
    slug
    title
    createdAt
    content
    ...ArticleHead
  }
  ${ArticleHeadFragmentDoc}
`;
export const ProductListComponentFragmentDoc = gql`
  fragment ProductListComponent on ProductList {
    description
    name
    emoji
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
  baseOptions: Apollo.QueryHookOptions<DistanceQuery, DistanceQueryVariables>,
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
export type DistanceQueryHookResult = ReturnType<typeof useDistanceQuery>;
export type DistanceLazyQueryHookResult = ReturnType<
  typeof useDistanceLazyQuery
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
  >,
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
export type DuplicateApplicationWarningQueryHookResult = ReturnType<
  typeof useDuplicateApplicationWarningQuery
>;
export type DuplicateApplicationWarningLazyQueryHookResult = ReturnType<
  typeof useDuplicateApplicationWarningLazyQuery
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
  >,
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
export type SpotifyArtistSearchQueryHookResult = ReturnType<
  typeof useSpotifyArtistSearchQuery
>;
export type SpotifyArtistSearchLazyQueryHookResult = ReturnType<
  typeof useSpotifyArtistSearchLazyQuery
>;
export type SpotifyArtistSearchQueryResult = Apollo.QueryResult<
  SpotifyArtistSearchQuery,
  SpotifyArtistSearchQueryVariables
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
  >,
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
export type BandSearchQueryHookResult = ReturnType<typeof useBandSearchQuery>;
export type BandSearchLazyQueryHookResult = ReturnType<
  typeof useBandSearchLazyQuery
>;
export type BandSearchQueryResult = Apollo.QueryResult<
  BandSearchQuery,
  BandSearchQueryVariables
>;
export const PageDocument = gql`
  query Page($id: ID!) {
    node(id: $id) {
      ... on Page {
        id
        title
        content
        left
        right
        bottom
      }
    }
  }
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
  baseOptions: Apollo.QueryHookOptions<PageQuery, PageQueryVariables>,
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
export type PageQueryHookResult = ReturnType<typeof usePageQuery>;
export type PageLazyQueryHookResult = ReturnType<typeof usePageLazyQuery>;
export type PageQueryResult = Apollo.QueryResult<PageQuery, PageQueryVariables>;
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
export type NewsQueryHookResult = ReturnType<typeof useNewsQuery>;
export type NewsLazyQueryHookResult = ReturnType<typeof useNewsLazyQuery>;
export type NewsQueryResult = Apollo.QueryResult<NewsQuery, NewsQueryVariables>;
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
export const ThanksDocument = gql`
  query Thanks($id: ID!) {
    node(id: $id) {
      ... on Event {
        bandApplicationEnd
        djApplicationEnd
      }
    }
  }
`;

/**
 * __useThanksQuery__
 *
 * To run a query within a React component, call `useThanksQuery` and pass it any options that fit your needs.
 * When your component renders, `useThanksQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useThanksQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useThanksQuery(
  baseOptions: Apollo.QueryHookOptions<ThanksQuery, ThanksQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<ThanksQuery, ThanksQueryVariables>(
    ThanksDocument,
    options,
  );
}
export function useThanksLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<ThanksQuery, ThanksQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<ThanksQuery, ThanksQueryVariables>(
    ThanksDocument,
    options,
  );
}
export type ThanksQueryHookResult = ReturnType<typeof useThanksQuery>;
export type ThanksLazyQueryHookResult = ReturnType<typeof useThanksLazyQuery>;
export type ThanksQueryResult = Apollo.QueryResult<
  ThanksQuery,
  ThanksQueryVariables
>;
export const EventDocument = gql`
  query Event($id: ID!) {
    node(id: $id) {
      ... on Event {
        name
        start
        end
        bandApplicationStart
        bandApplicationEnd
        djApplicationStart
        djApplicationEnd
      }
    }
  }
`;

/**
 * __useEventQuery__
 *
 * To run a query within a React component, call `useEventQuery` and pass it any options that fit your needs.
 * When your component renders, `useEventQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useEventQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useEventQuery(
  baseOptions: Apollo.QueryHookOptions<EventQuery, EventQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useQuery<EventQuery, EventQueryVariables>(
    EventDocument,
    options,
  );
}
export function useEventLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<EventQuery, EventQueryVariables>,
) {
  const options = {...defaultOptions, ...baseOptions};
  return Apollo.useLazyQuery<EventQuery, EventQueryVariables>(
    EventDocument,
    options,
  );
}
export type EventQueryHookResult = ReturnType<typeof useEventQuery>;
export type EventLazyQueryHookResult = ReturnType<typeof useEventLazyQuery>;
export type EventQueryResult = Apollo.QueryResult<
  EventQuery,
  EventQueryVariables
>;
export const LineupBandDocument = gql`
  query LineupBand($id: ID!) {
    node(id: $id) {
      ... on BandPlaying {
        name
        shortDescription
        description
        photo {
          scaledUri(width: 600)
          width
          height
        }
        startTime
        area {
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
 *      id: // value for 'id'
 *   },
 * });
 */
export function useLineupBandQuery(
  baseOptions: Apollo.QueryHookOptions<
    LineupBandQuery,
    LineupBandQueryVariables
  >,
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
export type LineupBandQueryHookResult = ReturnType<typeof useLineupBandQuery>;
export type LineupBandLazyQueryHookResult = ReturnType<
  typeof useLineupBandLazyQuery
>;
export type LineupBandQueryResult = Apollo.QueryResult<
  LineupBandQuery,
  LineupBandQueryVariables
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
      }
    }
    ...StageSelector
  }
  ${BandFragmentDoc}
  ${StageSelectorFragmentDoc}
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
  baseOptions: Apollo.QueryHookOptions<LineupQuery, LineupQueryVariables>,
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
export type LineupQueryHookResult = ReturnType<typeof useLineupQuery>;
export type LineupLazyQueryHookResult = ReturnType<typeof useLineupLazyQuery>;
export type LineupQueryResult = Apollo.QueryResult<
  LineupQuery,
  LineupQueryVariables
>;
export const NewsPageDocument = gql`
  query NewsPage($id: ID!) {
    node(id: $id) {
      ... on News {
        ...Article
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
  baseOptions: Apollo.QueryHookOptions<NewsPageQuery, NewsPageQueryVariables>,
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
export type NewsPageQueryHookResult = ReturnType<typeof useNewsPageQuery>;
export type NewsPageLazyQueryHookResult = ReturnType<
  typeof useNewsPageLazyQuery
>;
export type NewsPageQueryResult = Apollo.QueryResult<
  NewsPageQuery,
  NewsPageQueryVariables
>;
export const SpeisekarteDocument = gql`
  query Speisekarte {
    productLists(activeOnly: true) {
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
export type SpeisekarteQueryHookResult = ReturnType<typeof useSpeisekarteQuery>;
export type SpeisekarteLazyQueryHookResult = ReturnType<
  typeof useSpeisekarteLazyQuery
>;
export type SpeisekarteQueryResult = Apollo.QueryResult<
  SpeisekarteQuery,
  SpeisekarteQueryVariables
>;
