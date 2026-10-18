import {relations} from 'drizzle-orm/relations';
import {
  area,
  areaOpeningHour,
  viewer,
  bandApplication,
  event,
  bandApplicationComment,
  bandApplicationTag,
  bandPlaying,
  device,
  deviceLog,
  cardTransaction,
  order,
  crewCard,
  productList,
  deviceLocation,
  noiseLocationAssignment,
  noiseLocation,
  noiseProject,
  noiseLocationLimit,
  noiseLog,
  noiseTag,
  nonceRequest,
  nonce,
  orderItem,
  product,
  viewerLocation,
  productToProductAdditives,
  productAdditives,
  bandApplicationRating,
} from './schema';

export const areaOpeningHourRelations = relations(areaOpeningHour, ({one}) => ({
  area: one(area, {
    fields: [areaOpeningHour.areaId],
    references: [area.id],
  }),
}));

export const areaRelations = relations(area, ({many}) => ({
  areaOpeningHours: many(areaOpeningHour),
  bandPlayings: many(bandPlaying),
}));

export const bandApplicationRelations = relations(
  bandApplication,
  ({one, many}) => ({
    viewer: one(viewer, {
      fields: [bandApplication.contactedByViewerId],
      references: [viewer.id],
    }),
    event: one(event, {
      fields: [bandApplication.eventId],
      references: [event.id],
    }),
    bandApplicationComments: many(bandApplicationComment),
    bandApplicationTags: many(bandApplicationTag),
    bandApplicationRatings: many(bandApplicationRating),
  }),
);

export const viewerRelations = relations(viewer, ({many}) => ({
  bandApplications: many(bandApplication),
  bandApplicationComments: many(bandApplicationComment),
  bandApplicationTags: many(bandApplicationTag),
  crewCards: many(crewCard),
  productLists: many(productList),
  noiseTags: many(noiseTag),
  nonceRequests: many(nonceRequest),
  nonces: many(nonce),
  viewerLocations: many(viewerLocation),
  bandApplicationRatings: many(bandApplicationRating),
}));

export const eventRelations = relations(event, ({many}) => ({
  bandApplications: many(bandApplication),
  bandPlayings: many(bandPlaying),
}));

export const bandApplicationCommentRelations = relations(
  bandApplicationComment,
  ({one}) => ({
    bandApplication: one(bandApplication, {
      fields: [bandApplicationComment.bandApplicationId],
      references: [bandApplication.id],
    }),
    viewer: one(viewer, {
      fields: [bandApplicationComment.viewerId],
      references: [viewer.id],
    }),
  }),
);

export const bandApplicationTagRelations = relations(
  bandApplicationTag,
  ({one}) => ({
    bandApplication: one(bandApplication, {
      fields: [bandApplicationTag.bandApplicationId],
      references: [bandApplication.id],
    }),
    viewer: one(viewer, {
      fields: [bandApplicationTag.createdByViewerId],
      references: [viewer.id],
    }),
  }),
);

export const bandPlayingRelations = relations(bandPlaying, ({one}) => ({
  area: one(area, {
    fields: [bandPlaying.areaId],
    references: [area.id],
  }),
  event: one(event, {
    fields: [bandPlaying.eventId],
    references: [event.id],
  }),
}));

export const deviceLogRelations = relations(deviceLog, ({one, many}) => ({
  device: one(device, {
    fields: [deviceLog.deviceId],
    references: [device.id],
  }),
  cardTransactions: many(cardTransaction),
}));

export const deviceRelations = relations(device, ({one, many}) => ({
  deviceLogs: many(deviceLog),
  orders: many(order),
  productList: one(productList, {
    fields: [device.productListId],
    references: [productList.id],
  }),
  deviceLocations: many(deviceLocation),
  noiseLocationAssignments: many(noiseLocationAssignment),
  noiseLogs: many(noiseLog),
  noiseTags: many(noiseTag),
}));

export const cardTransactionRelations = relations(cardTransaction, ({one}) => ({
  deviceLog: one(deviceLog, {
    fields: [cardTransaction.clientId],
    references: [deviceLog.clientId],
  }),
  order: one(order, {
    fields: [cardTransaction.orderId],
    references: [order.id],
  }),
}));

export const orderRelations = relations(order, ({one, many}) => ({
  cardTransactions: many(cardTransaction),
  crewCard: one(crewCard, {
    fields: [order.crewCardId],
    references: [crewCard.id],
  }),
  device: one(device, {
    fields: [order.deviceId],
    references: [device.id],
  }),
  orderItems: many(orderItem),
}));

export const crewCardRelations = relations(crewCard, ({one, many}) => ({
  orders: many(order),
  viewer: one(viewer, {
    fields: [crewCard.viewerId],
    references: [viewer.id],
  }),
}));

export const productListRelations = relations(productList, ({one, many}) => ({
  devices: many(device),
  viewer: one(viewer, {
    fields: [productList.lastUpdatedBy],
    references: [viewer.id],
  }),
  orderItems: many(orderItem),
  products: many(product),
}));

export const deviceLocationRelations = relations(deviceLocation, ({one}) => ({
  device: one(device, {
    fields: [deviceLocation.deviceId],
    references: [device.id],
  }),
}));

export const noiseLocationAssignmentRelations = relations(
  noiseLocationAssignment,
  ({one}) => ({
    device: one(device, {
      fields: [noiseLocationAssignment.deviceId],
      references: [device.id],
    }),
    noiseLocation: one(noiseLocation, {
      fields: [noiseLocationAssignment.locationId],
      references: [noiseLocation.id],
    }),
  }),
);

export const noiseLocationRelations = relations(
  noiseLocation,
  ({one, many}) => ({
    noiseLocationAssignments: many(noiseLocationAssignment),
    noiseProject: one(noiseProject, {
      fields: [noiseLocation.projectId],
      references: [noiseProject.id],
    }),
    noiseLocationLimits: many(noiseLocationLimit),
    noiseTags: many(noiseTag),
  }),
);

export const noiseProjectRelations = relations(noiseProject, ({many}) => ({
  noiseLocations: many(noiseLocation),
  noiseTags: many(noiseTag),
}));

export const noiseLocationLimitRelations = relations(
  noiseLocationLimit,
  ({one}) => ({
    noiseLocation: one(noiseLocation, {
      fields: [noiseLocationLimit.locationId],
      references: [noiseLocation.id],
    }),
  }),
);

export const noiseLogRelations = relations(noiseLog, ({one}) => ({
  device: one(device, {
    fields: [noiseLog.deviceId],
    references: [device.id],
  }),
}));

export const noiseTagRelations = relations(noiseTag, ({one}) => ({
  viewer: one(viewer, {
    fields: [noiseTag.createdByViewerId],
    references: [viewer.id],
  }),
  device: one(device, {
    fields: [noiseTag.deviceId],
    references: [device.id],
  }),
  noiseLocation: one(noiseLocation, {
    fields: [noiseTag.locationId],
    references: [noiseLocation.id],
  }),
  noiseProject: one(noiseProject, {
    fields: [noiseTag.projectId],
    references: [noiseProject.id],
  }),
}));

export const nonceRequestRelations = relations(nonceRequest, ({one}) => ({
  viewer: one(viewer, {
    fields: [nonceRequest.createdForId],
    references: [viewer.id],
  }),
}));

export const nonceRelations = relations(nonce, ({one}) => ({
  viewer: one(viewer, {
    fields: [nonce.createdForId],
    references: [viewer.id],
  }),
}));

export const orderItemRelations = relations(orderItem, ({one}) => ({
  order: one(order, {
    fields: [orderItem.orderId],
    references: [order.id],
  }),
  productList: one(productList, {
    fields: [orderItem.productListId],
    references: [productList.id],
  }),
}));

export const productRelations = relations(product, ({one, many}) => ({
  productList: one(productList, {
    fields: [product.productListId],
    references: [productList.id],
  }),
  productToProductAdditives: many(productToProductAdditives),
}));

export const viewerLocationRelations = relations(viewerLocation, ({one}) => ({
  viewer: one(viewer, {
    fields: [viewerLocation.viewerId],
    references: [viewer.id],
  }),
}));

export const productToProductAdditivesRelations = relations(
  productToProductAdditives,
  ({one}) => ({
    product: one(product, {
      fields: [productToProductAdditives.A],
      references: [product.id],
    }),
    productAdditive: one(productAdditives, {
      fields: [productToProductAdditives.B],
      references: [productAdditives.id],
    }),
  }),
);

export const productAdditivesRelations = relations(
  productAdditives,
  ({many}) => ({
    productToProductAdditives: many(productToProductAdditives),
  }),
);

export const bandApplicationRatingRelations = relations(
  bandApplicationRating,
  ({one}) => ({
    bandApplication: one(bandApplication, {
      fields: [bandApplicationRating.bandApplicationId],
      references: [bandApplication.id],
    }),
    viewer: one(viewer, {
      fields: [bandApplicationRating.viewerId],
      references: [viewer.id],
    }),
  }),
);
