// The app's tables (Postgres schema `public`) — the source of truth for the
// database. To change it: edit this file, `yarn db:generate` for a migration in
// drizzle/, review the SQL, then `yarn db:migrate` (local .env is production).
// Functions and triggers live in hand-written SQL in the migrations.
//
// Started as `drizzle-kit pull` from production (2026-10-18), with these
// edits: timestamps read as `Date` (`mode: 'date'`); citext and bytea as custom
// types; default index opclasses (pull emitted wrong ones).
//
// Timestamps are `timestamptz` (defaults at millisecond precision, like a JS
// `Date`), and generated ids (`gen_random_uuid()`) and
// `Viewer.updatedAt` (trigger) are filled in by the database, so writers
// outside the app (Directus, SQL) get them too. Ids are opaque text: older
// rows have Prisma cuids.
import {
  customType,
  pgTable,
  uniqueIndex,
  integer,
  serial,
  timestamp,
  index,
  text,
  uuid,
  doublePrecision,
  jsonb,
  foreignKey,
  boolean,
  varchar,
  smallint,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
import * as enums from '../../utils/enums';

// Case-insensitive text (the `citext` extension), read and written as string.
const citext = customType<{data: string}>({dataType: () => 'citext'});

// Binary data. node-postgres returns a Buffer (a Uint8Array, like Prisma's
// `Bytes`).
const bytea = customType<{data: Buffer; driverData: Buffer}>({
  dataType: () => 'bytea',
});

export const bandRepertoire = pgEnum('BandRepertoire', enums.BandRepertoire);
export const cardTransactionType = pgEnum(
  'CardTransactionType',
  enums.CardTransactionType,
);
export const demoEmbedType = pgEnum('DemoEmbedType', enums.DemoEmbedType);
export const deviceType = pgEnum('DeviceType', enums.DeviceType);
export const dietType = pgEnum('DietType', enums.DietType);
export const donationSource = pgEnum('DonationSource', enums.DonationSource);
export const eventType = pgEnum('EventType', enums.EventType);
export const genreCategory = pgEnum('GenreCategory', enums.GenreCategory);
export const heardAboutBookingFrom = pgEnum(
  'HeardAboutBookingFrom',
  enums.HeardAboutBookingFrom,
);
export const minimumAge = pgEnum('MinimumAge', enums.MinimumAge);
export const noiseTagType = pgEnum('NoiseTagType', enums.NoiseTagType);
export const nonceRequestStatus = pgEnum(
  'NonceRequestStatus',
  enums.NonceRequestStatus,
);
export const orderPayment = pgEnum('OrderPayment', enums.OrderPayment);
export const previouslyPlayed = pgEnum(
  'PreviouslyPlayed',
  enums.PreviouslyPlayed,
);

export const deviceConfigVersion = pgTable(
  'DeviceConfigVersion',
  {
    crc32: integer().notNull(),
    version: serial().primaryKey().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('DeviceConfigVersion_crc32_key').using('btree', table.crc32),
  ],
);

export const donation = pgTable(
  'Donation',
  {
    amount: integer().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    email: text(),
    name: text(),
    reference: text(),
    source: donationSource().notNull(),
    message: text(),
    sentConfirmationAt: timestamp({withTimezone: true, mode: 'date'}),
    id: uuid().defaultRandom().primaryKey().notNull(),
    spendenQuittungAt: timestamp({withTimezone: true, mode: 'date'}),
    quittungCity: text(),
    quittungName: text(),
    quittungStreet: text(),
    amountPins: integer(),
  },
  (table) => [index('Donation_reference_idx').using('btree', table.reference)],
);

export const gmailReminders = pgTable('GmailReminders', {
  messageId: text().primaryKey().notNull(),
  account: text().notNull(),
});

export const itemLocation = pgTable('ItemLocation', {
  timeStamp: timestamp({withTimezone: true, mode: 'date'})
    .primaryKey()
    .notNull(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
  payload: jsonb().notNull(),
});

export const page = pgTable('Page', {
  slug: text().primaryKey().notNull(),
  content: text(),
  left: text(),
  right: text(),
  bottom: text(),
  title: text().notNull(),
});

export const shortDomainRedirect = pgTable('ShortDomainRedirect', {
  slug: text().primaryKey().notNull(),
  targetUrl: text().notNull(),
});

export const twoFactor = pgTable(
  'TwoFactor',
  {
    account: text().notNull(),
    service: text().notNull(),
    secret: text().notNull(),
  },
  (table) => [
    uniqueIndex('TwoFactor_account_service_key').using(
      'btree',
      table.account,
      table.service,
    ),
  ],
);

export const news = pgTable('News', {
  slug: text().primaryKey().notNull(),
  title: text().notNull(),
  content: text().notNull(),
  createdAt: timestamp({withTimezone: true, mode: 'date'})
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .notNull(),
});

export const event = pgTable('Event', {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  start: timestamp({withTimezone: true, mode: 'date'}).notNull(),
  end: timestamp({withTimezone: true, mode: 'date'}).notNull(),
  eventType: eventType().notNull(),
  bandApplicationStart: timestamp({withTimezone: true, mode: 'date'}),
  bandApplicationEnd: timestamp({withTimezone: true, mode: 'date'}),
  djApplicationEnd: timestamp({withTimezone: true, mode: 'date'}),
  poster: uuid(),
  description: text(),
  djApplicationStart: timestamp({withTimezone: true, mode: 'date'}),
  latitude: doublePrecision(),
  location: text(),
  longitude: doublePrecision(),
  lineupAnnouncementTime: timestamp({withTimezone: true, mode: 'date'}),
  immichAlbumShareUrl: text(),
});

export const area = pgTable('Area', {
  id: text().primaryKey().notNull(),
  displayName: text().notNull(),
  order: integer().notNull(),
  themeColor: text().notNull(),
  latitude: doublePrecision().notNull(),
  longitude: doublePrecision().notNull(),
});

export const areaOpeningHour = pgTable(
  'AreaOpeningHour',
  {
    id: serial().primaryKey().notNull(),
    startTime: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    endTime: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    areaId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.areaId],
      foreignColumns: [area.id],
      name: 'AreaOpeningHour_areaId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const bandApplication = pgTable(
  'BandApplication',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    email: text().notNull(),
    bandname: text().notNull(),
    genre: text(),
    city: text().notNull(),
    facebook: text(),
    demo: text(),
    description: text(),
    numberOfArtists: integer(),
    numberOfNonMaleArtists: integer(),
    contactName: text().notNull(),
    contactPhone: text().notNull(),
    knowsKultFrom: text(),
    distance: doublePrecision(),
    facebookLikes: integer(),
    website: text(),
    genreCategory: genreCategory().notNull(),
    heardAboutBookingFrom: heardAboutBookingFrom(),
    contactedByViewerId: text(),
    instagram: text(),
    instagramFollower: integer(),
    eventId: text().notNull(),
    hasPreviouslyPlayed: previouslyPlayed(),
    lastContactedAt: timestamp({withTimezone: true, mode: 'date'}),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    demoEmbedUrl: text(),
    demoEmbed: text(),
    demoEmbedType: demoEmbedType(),
    repertoire: bandRepertoire(),
    spotifyArtist: text(),
    spotifyMonthlyListeners: integer(),
    imageUrl: text(),
    stageColumn: integer(),
    stageRow: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.contactedByViewerId],
      foreignColumns: [viewer.id],
      name: 'BandApplication_contactedByViewerId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [event.id],
      name: 'BandApplication_eventId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const bandApplicationComment = pgTable(
  'BandApplicationComment',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    viewerId: text().notNull(),
    comment: text().notNull(),
    bandApplicationId: uuid().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.bandApplicationId],
      foreignColumns: [bandApplication.id],
      name: 'BandApplicationComment_bandApplicationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.viewerId],
      foreignColumns: [viewer.id],
      name: 'BandApplicationComment_viewerId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const viewer = pgTable('Viewer', {
  // Slack-keyed Viewers set the id themselves (the Slack user id).
  id: text()
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()::text`),
  displayName: text().notNull(),
  email: text().notNull(),
  profilePicture: text(),
  slackToken: text(),
  slackScopes: text().array(),
  updatedAt: timestamp({withTimezone: true, mode: 'date'})
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .notNull(),
});

export const bandApplicationTag = pgTable(
  'BandApplicationTag',
  {
    bandApplicationId: uuid().notNull(),
    tag: citext().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    createdByViewerId: text().notNull(),
  },
  (table) => [
    uniqueIndex('BandApplicationTag_bandApplicationId_tag_key').using(
      'btree',
      table.bandApplicationId,
      table.tag,
    ),
    foreignKey({
      columns: [table.bandApplicationId],
      foreignColumns: [bandApplication.id],
      name: 'BandApplicationTag_bandApplicationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.createdByViewerId],
      foreignColumns: [viewer.id],
      name: 'BandApplicationTag_createdByViewerId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const bandPlaying = pgTable(
  'BandPlaying',
  {
    name: text().notNull(),
    startTime: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    endTime: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    description: text(),
    shortDescription: text(),
    genre: text(),
    instagram: text(),
    spotify: text(),
    facebook: text(),
    website: text(),
    youtube: text(),
    soundcloud: text(),
    areaId: text().notNull(),
    eventId: text().notNull(),
    slug: text().notNull(),
    photo: uuid(),
    id: uuid().defaultRandom().primaryKey().notNull(),
    spotifyPreviewUrl: text(),
  },
  (table) => [
    uniqueIndex('BandPlaying_areaId_startTime_key').using(
      'btree',
      table.areaId,
      table.startTime,
    ),
    uniqueIndex('BandPlaying_eventId_slug_key').using(
      'btree',
      table.eventId,
      table.slug,
    ),
    foreignKey({
      columns: [table.areaId],
      foreignColumns: [area.id],
      name: 'BandPlaying_areaId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [event.id],
      name: 'BandPlaying_eventId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const deviceLog = pgTable(
  'DeviceLog',
  {
    clientId: text().primaryKey().notNull(),
    batteryVoltage: integer(),
    usbVoltage: integer(),
    deviceId: text().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    deviceTime: timestamp({withTimezone: true, mode: 'date'}).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.deviceId],
      foreignColumns: [device.id],
      name: 'DeviceLog_deviceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const cardTransaction = pgTable(
  'CardTransaction',
  {
    clientId: text().primaryKey().notNull(),
    cardId: text().notNull(),
    depositBefore: integer().notNull(),
    depositAfter: integer().notNull(),
    balanceBefore: integer().notNull(),
    balanceAfter: integer().notNull(),
    transactionType: cardTransactionType().notNull(),
    counter: integer(),
    orderId: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [deviceLog.clientId],
      name: 'CardTransaction_clientId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [order.id],
      name: 'CardTransaction_orderId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const order = pgTable(
  'Order',
  {
    id: serial().primaryKey().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    payment: orderPayment().notNull(),
    deposit: integer().default(0).notNull(),
    deviceId: text(),
    crewCardId: bytea(),
    notForMe: boolean(),
  },
  (table) => [
    foreignKey({
      columns: [table.crewCardId],
      foreignColumns: [crewCard.id],
      name: 'Order_crewCardId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.deviceId],
      foreignColumns: [device.id],
      name: 'Order_deviceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const crewCard = pgTable(
  'CrewCard',
  {
    id: bytea().primaryKey().notNull(),
    nickname: text(),
    suspended: boolean().default(false).notNull(),
    privileged: boolean().default(false).notNull(),
    viewerId: text(),
    validUntil: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    enrolledAt: timestamp({withTimezone: true, mode: 'date'}).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.viewerId],
      foreignColumns: [viewer.id],
      name: 'CrewCard_viewerId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const device = pgTable(
  'Device',
  {
    id: text().primaryKey().notNull(),
    lastSeen: timestamp({withTimezone: true, mode: 'date'}),
    productListId: integer(),
    softwareVersion: text(),
    type: deviceType().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.productListId],
      foreignColumns: [productList.id],
      name: 'Device_productListId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const deviceLocation = pgTable(
  'DeviceLocation',
  {
    id: text().primaryKey().notNull(),
    deviceId: text().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    locationName: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.deviceId],
      foreignColumns: [device.id],
      name: 'DeviceLocation_deviceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const productList = pgTable(
  'ProductList',
  {
    // In production the sequence is `productlist_id_seq` (it predates
    // Prisma's naming); drizzle-kit doesn't compare sequence names, so
    // `serial()` matches. A fresh database gets `ProductList_id_seq`.
    id: serial().primaryKey().notNull(),
    name: varchar({length: 20}).notNull(),
    emoji: text(),
    active: boolean().default(true).notNull(),
    updatedAt: timestamp({withTimezone: true, mode: 'date'}),
    description: text(),
    lastUpdatedBy: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.lastUpdatedBy],
      foreignColumns: [viewer.id],
      name: 'ProductList_lastUpdatedBy_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const noiseLocationAssignment = pgTable(
  'NoiseLocationAssignment',
  {
    id: text()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    locationId: text().notNull(),
    deviceId: text().notNull(),
    start: timestamp({withTimezone: true, mode: 'date'}),
    end: timestamp({withTimezone: true, mode: 'date'}),
  },
  (table) => [
    index('NoiseLocationAssignment_deviceId_start_idx').using(
      'btree',
      table.deviceId,
      table.start,
    ),
    index('NoiseLocationAssignment_locationId_start_idx').using(
      'btree',
      table.locationId,
      table.start,
    ),
    foreignKey({
      columns: [table.deviceId],
      foreignColumns: [device.id],
      name: 'NoiseLocationAssignment_deviceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [noiseLocation.id],
      name: 'NoiseLocationAssignment_locationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const noiseLocation = pgTable(
  'NoiseLocation',
  {
    id: text()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    projectId: text().notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    locationName: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [noiseProject.id],
      name: 'NoiseLocation_projectId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const noiseLocationLimit = pgTable(
  'NoiseLocationLimit',
  {
    id: text()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    locationId: text().notNull(),
    decibels: doublePrecision().notNull(),
    start: timestamp({withTimezone: true, mode: 'date'}),
    end: timestamp({withTimezone: true, mode: 'date'}),
    series: text().notNull(),
  },
  (table) => [
    index('NoiseLocationLimit_locationId_start_idx').using(
      'btree',
      table.locationId,
      table.start,
    ),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [noiseLocation.id],
      name: 'NoiseLocationLimit_locationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const noiseProject = pgTable('NoiseProject', {
  id: text()
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()::text`),
  name: text().notNull(),
  start: timestamp({withTimezone: true, mode: 'date'}).notNull(),
  end: timestamp({withTimezone: true, mode: 'date'}).notNull(),
});

export const noiseLog = pgTable(
  'NoiseLog',
  {
    id: text()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    deviceId: text().notNull(),
    measuredAt: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    bands: bytea().notNull(),
    laeq: smallint().notNull(),
    lafmax: smallint().notNull(),
    lceq: smallint().notNull(),
    lcfmax: smallint().notNull(),
    lcpeak: smallint().notNull(),
    laeq30m: smallint(),
    laeq5m: smallint(),
    lceq30m: smallint(),
    lceq5m: smallint(),
  },
  (table) => [
    uniqueIndex('NoiseLog_deviceId_measuredAt_key').using(
      'btree',
      table.deviceId,
      table.measuredAt,
    ),
    foreignKey({
      columns: [table.deviceId],
      foreignColumns: [device.id],
      name: 'NoiseLog_deviceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const noiseTag = pgTable(
  'NoiseTag',
  {
    id: text()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    projectId: text().notNull(),
    locationId: text(),
    deviceId: text(),
    type: noiseTagType().notNull(),
    start: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    end: timestamp({withTimezone: true, mode: 'date'}),
    text: text(),
    createdAt: timestamp({withTimezone: true, mode: 'date'})
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    createdByViewerId: text().notNull(),
    dedupeKey: text(),
  },
  (table) => [
    uniqueIndex('NoiseTag_dedupeKey_key').using('btree', table.dedupeKey),
    index('NoiseTag_projectId_start_idx').using(
      'btree',
      table.projectId,
      table.start,
    ),
    foreignKey({
      columns: [table.createdByViewerId],
      foreignColumns: [viewer.id],
      name: 'NoiseTag_createdByViewerId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.deviceId],
      foreignColumns: [device.id],
      name: 'NoiseTag_deviceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.locationId],
      foreignColumns: [noiseLocation.id],
      name: 'NoiseTag_locationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [noiseProject.id],
      name: 'NoiseTag_projectId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const nonceRequest = pgTable(
  'NonceRequest',
  {
    expiresAt: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    createdForId: text(),
    status: nonceRequestStatus().default('Pending').notNull(),
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdForEmail: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.createdForId],
      foreignColumns: [viewer.id],
      name: 'NonceRequest_createdForId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const nonce = pgTable(
  'Nonce',
  {
    nonce: uuid().defaultRandom().primaryKey().notNull(),
    expiresAt: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    createdForId: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.createdForId],
      foreignColumns: [viewer.id],
      name: 'Nonce_createdForId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const orderItem = pgTable(
  'OrderItem',
  {
    id: serial().primaryKey().notNull(),
    orderId: integer().notNull(),
    amount: integer().notNull(),
    note: text(),
    name: text().notNull(),
    perUnitPrice: integer().notNull(),
    productListId: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.orderId],
      foreignColumns: [order.id],
      name: 'OrderItem_orderId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.productListId],
      foreignColumns: [productList.id],
      name: 'OrderItem_productListId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const product = pgTable(
  'Product',
  {
    id: serial().primaryKey().notNull(),
    name: varchar({length: 30}).notNull(),
    price: integer().notNull(),
    order: integer().notNull(),
    productListId: integer().notNull(),
    requiresDeposit: boolean().default(false).notNull(),
    diet: dietType(),
    minimumAge: minimumAge().default('NONE').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.productListId],
      foreignColumns: [productList.id],
      name: 'Product_productListId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const viewerLocation = pgTable(
  'ViewerLocation',
  {
    id: text()
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    viewerId: text().notNull(),
    createdAt: timestamp({withTimezone: true, mode: 'date'}).notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    payload: jsonb().notNull(),
  },
  (table) => [
    index('ViewerLocation_viewerId_createdAt_idx').using(
      'btree',
      table.viewerId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.viewerId],
      foreignColumns: [viewer.id],
      name: 'ViewerLocation_viewerId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
  ],
);

export const productAdditives = pgTable('ProductAdditives', {
  id: text().primaryKey().notNull(),
  displayName: text().notNull(),
});

export const productToProductAdditives = pgTable(
  '_ProductToProductAdditives',
  {
    // Prisma's implicit many-to-many join table. The keys match the column
    // names: drizzle-kit compares the composite primary key by key.
    A: integer().notNull(),
    B: text().notNull(),
  },
  (table) => [
    index().using('btree', table.B),
    foreignKey({
      columns: [table.A],
      foreignColumns: [product.id],
      name: '_ProductToProductAdditives_A_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.B],
      foreignColumns: [productAdditives.id],
      name: '_ProductToProductAdditives_B_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    primaryKey({
      columns: [table.A, table.B],
      name: '_ProductToProductAdditives_AB_pkey',
    }),
  ],
);

export const bandApplicationRating = pgTable(
  'BandApplicationRating',
  {
    viewerId: text().notNull(),
    rating: integer().notNull(),
    bandApplicationId: uuid().notNull(),
  },
  (table) => [
    index('BandApplicationRating_bandApplicationId_idx').using(
      'btree',
      table.bandApplicationId,
    ),
    foreignKey({
      columns: [table.bandApplicationId],
      foreignColumns: [bandApplication.id],
      name: 'BandApplicationRating_bandApplicationId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    foreignKey({
      columns: [table.viewerId],
      foreignColumns: [viewer.id],
      name: 'BandApplicationRating_viewerId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    primaryKey({
      // Same column order as the production primary key (it's also the index).
      columns: [table.viewerId, table.bandApplicationId],
      name: 'BandApplicationRating_pkey',
    }),
  ],
);
