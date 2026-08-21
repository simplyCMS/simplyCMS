import { relations } from "drizzle-orm/relations";
import { sections, sectionProperties, priceTypes, userCategories, userRoles, products, wishlists, comparisons, productModifications, orderItems, orders, services, modificationPropertyValues, propertyOptions, productPropertyValues, sectionPropertyAssignments, serviceRequests, shippingMethods, shippingRates, shippingZones, pickupPoints, stockByPickupPoint, profiles, userCategoryHistory, categoryRules, userAddresses, userRecipients, orderStatuses, productPrices, discountGroups, discounts, discountTargets, discountConditions, productReviews, banners } from "./schema";
import { usersInAuth } from "./auth-users";

export const sectionsRelations = relations(sections, ({one, many}) => ({
	section: one(sections, {
		fields: [sections.parentId],
		references: [sections.id],
		relationName: "sections_parentId_sections_id"
	}),
	sections: many(sections, {
		relationName: "sections_parentId_sections_id"
	}),
	sectionProperties: many(sectionProperties),
	sectionPropertyAssignments: many(sectionPropertyAssignments),
	products: many(products),
	banners: many(banners),
}));

export const sectionPropertiesRelations = relations(sectionProperties, ({one, many}) => ({
	section: one(sections, {
		fields: [sectionProperties.sectionId],
		references: [sections.id]
	}),
	modificationPropertyValues: many(modificationPropertyValues),
	productPropertyValues: many(productPropertyValues),
	propertyOptions: many(propertyOptions),
	sectionPropertyAssignments: many(sectionPropertyAssignments),
}));

export const userCategoriesRelations = relations(userCategories, ({one, many}) => ({
	priceType: one(priceTypes, {
		fields: [userCategories.priceTypeId],
		references: [priceTypes.id]
	}),
	profiles: many(profiles),
	userCategoryHistories_fromCategoryId: many(userCategoryHistory, {
		relationName: "userCategoryHistory_fromCategoryId_userCategories_id"
	}),
	userCategoryHistories_toCategoryId: many(userCategoryHistory, {
		relationName: "userCategoryHistory_toCategoryId_userCategories_id"
	}),
	categoryRules_fromCategoryId: many(categoryRules, {
		relationName: "categoryRules_fromCategoryId_userCategories_id"
	}),
	categoryRules_toCategoryId: many(categoryRules, {
		relationName: "categoryRules_toCategoryId_userCategories_id"
	}),
}));

export const priceTypesRelations = relations(priceTypes, ({many}) => ({
	userCategories: many(userCategories),
	productPrices: many(productPrices),
	discounts: many(discounts),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userRoles.userId],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	userRoles: many(userRoles),
	wishlists: many(wishlists),
	comparisons: many(comparisons),
	serviceRequests: many(serviceRequests),
	profiles: many(profiles),
	orders: many(orders),
}));

export const wishlistsRelations = relations(wishlists, ({one}) => ({
	product: one(products, {
		fields: [wishlists.productId],
		references: [products.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [wishlists.userId],
		references: [usersInAuth.id]
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	wishlists: many(wishlists),
	comparisons: many(comparisons),
	orderItems: many(orderItems),
	productPropertyValues: many(productPropertyValues),
	section: one(sections, {
		fields: [products.sectionId],
		references: [sections.id]
	}),
	productModifications: many(productModifications),
	stockByPickupPoints: many(stockByPickupPoint),
	productPrices: many(productPrices),
	productReviews: many(productReviews),
}));

export const comparisonsRelations = relations(comparisons, ({one}) => ({
	product: one(products, {
		fields: [comparisons.productId],
		references: [products.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [comparisons.userId],
		references: [usersInAuth.id]
	}),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	productModification: one(productModifications, {
		fields: [orderItems.modificationId],
		references: [productModifications.id]
	}),
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id]
	}),
	service: one(services, {
		fields: [orderItems.serviceId],
		references: [services.id]
	}),
}));

export const productModificationsRelations = relations(productModifications, ({one, many}) => ({
	orderItems: many(orderItems),
	modificationPropertyValues: many(modificationPropertyValues),
	product: one(products, {
		fields: [productModifications.productId],
		references: [products.id]
	}),
	stockByPickupPoints: many(stockByPickupPoint),
	productPrices: many(productPrices),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	orderItems: many(orderItems),
	pickupPoint: one(pickupPoints, {
		fields: [orders.pickupPointId],
		references: [pickupPoints.id]
	}),
	userAddress: one(userAddresses, {
		fields: [orders.savedAddressId],
		references: [userAddresses.id]
	}),
	userRecipient: one(userRecipients, {
		fields: [orders.savedRecipientId],
		references: [userRecipients.id]
	}),
	shippingMethod: one(shippingMethods, {
		fields: [orders.shippingMethodId],
		references: [shippingMethods.id]
	}),
	shippingRate: one(shippingRates, {
		fields: [orders.shippingRateId],
		references: [shippingRates.id]
	}),
	shippingZone: one(shippingZones, {
		fields: [orders.shippingZoneId],
		references: [shippingZones.id]
	}),
	orderStatus: one(orderStatuses, {
		fields: [orders.statusId],
		references: [orderStatuses.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [orders.userId],
		references: [usersInAuth.id]
	}),
}));

export const servicesRelations = relations(services, ({many}) => ({
	orderItems: many(orderItems),
	serviceRequests: many(serviceRequests),
}));

export const modificationPropertyValuesRelations = relations(modificationPropertyValues, ({one}) => ({
	productModification: one(productModifications, {
		fields: [modificationPropertyValues.modificationId],
		references: [productModifications.id]
	}),
	propertyOption: one(propertyOptions, {
		fields: [modificationPropertyValues.optionId],
		references: [propertyOptions.id]
	}),
	sectionProperty: one(sectionProperties, {
		fields: [modificationPropertyValues.propertyId],
		references: [sectionProperties.id]
	}),
}));

export const propertyOptionsRelations = relations(propertyOptions, ({one, many}) => ({
	modificationPropertyValues: many(modificationPropertyValues),
	productPropertyValues: many(productPropertyValues),
	sectionProperty: one(sectionProperties, {
		fields: [propertyOptions.propertyId],
		references: [sectionProperties.id]
	}),
}));

export const productPropertyValuesRelations = relations(productPropertyValues, ({one}) => ({
	propertyOption: one(propertyOptions, {
		fields: [productPropertyValues.optionId],
		references: [propertyOptions.id]
	}),
	product: one(products, {
		fields: [productPropertyValues.productId],
		references: [products.id]
	}),
	sectionProperty: one(sectionProperties, {
		fields: [productPropertyValues.propertyId],
		references: [sectionProperties.id]
	}),
}));

export const sectionPropertyAssignmentsRelations = relations(sectionPropertyAssignments, ({one}) => ({
	sectionProperty: one(sectionProperties, {
		fields: [sectionPropertyAssignments.propertyId],
		references: [sectionProperties.id]
	}),
	section: one(sections, {
		fields: [sectionPropertyAssignments.sectionId],
		references: [sections.id]
	}),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({one}) => ({
	service: one(services, {
		fields: [serviceRequests.serviceId],
		references: [services.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [serviceRequests.userId],
		references: [usersInAuth.id]
	}),
}));

export const shippingRatesRelations = relations(shippingRates, ({one, many}) => ({
	shippingMethod: one(shippingMethods, {
		fields: [shippingRates.methodId],
		references: [shippingMethods.id]
	}),
	shippingZone: one(shippingZones, {
		fields: [shippingRates.zoneId],
		references: [shippingZones.id]
	}),
	orders: many(orders),
}));

export const shippingMethodsRelations = relations(shippingMethods, ({many}) => ({
	shippingRates: many(shippingRates),
	pickupPoints: many(pickupPoints),
	profiles: many(profiles),
	orders: many(orders),
}));

export const shippingZonesRelations = relations(shippingZones, ({many}) => ({
	shippingRates: many(shippingRates),
	pickupPoints: many(pickupPoints),
	orders: many(orders),
}));

export const pickupPointsRelations = relations(pickupPoints, ({one, many}) => ({
	shippingMethod: one(shippingMethods, {
		fields: [pickupPoints.methodId],
		references: [shippingMethods.id]
	}),
	shippingZone: one(shippingZones, {
		fields: [pickupPoints.zoneId],
		references: [shippingZones.id]
	}),
	stockByPickupPoints: many(stockByPickupPoint),
	profiles: many(profiles),
	orders: many(orders),
}));

export const stockByPickupPointRelations = relations(stockByPickupPoint, ({one}) => ({
	productModification: one(productModifications, {
		fields: [stockByPickupPoint.modificationId],
		references: [productModifications.id]
	}),
	pickupPoint: one(pickupPoints, {
		fields: [stockByPickupPoint.pickupPointId],
		references: [pickupPoints.id]
	}),
	product: one(products, {
		fields: [stockByPickupPoint.productId],
		references: [products.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	userCategory: one(userCategories, {
		fields: [profiles.categoryId],
		references: [userCategories.id]
	}),
	pickupPoint: one(pickupPoints, {
		fields: [profiles.defaultPickupPointId],
		references: [pickupPoints.id]
	}),
	shippingMethod: one(shippingMethods, {
		fields: [profiles.defaultShippingMethodId],
		references: [shippingMethods.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [profiles.userId],
		references: [usersInAuth.id]
	}),
}));

export const userCategoryHistoryRelations = relations(userCategoryHistory, ({one}) => ({
	userCategory_fromCategoryId: one(userCategories, {
		fields: [userCategoryHistory.fromCategoryId],
		references: [userCategories.id],
		relationName: "userCategoryHistory_fromCategoryId_userCategories_id"
	}),
	categoryRule: one(categoryRules, {
		fields: [userCategoryHistory.ruleId],
		references: [categoryRules.id]
	}),
	userCategory_toCategoryId: one(userCategories, {
		fields: [userCategoryHistory.toCategoryId],
		references: [userCategories.id],
		relationName: "userCategoryHistory_toCategoryId_userCategories_id"
	}),
}));

export const categoryRulesRelations = relations(categoryRules, ({one, many}) => ({
	userCategoryHistories: many(userCategoryHistory),
	userCategory_fromCategoryId: one(userCategories, {
		fields: [categoryRules.fromCategoryId],
		references: [userCategories.id],
		relationName: "categoryRules_fromCategoryId_userCategories_id"
	}),
	userCategory_toCategoryId: one(userCategories, {
		fields: [categoryRules.toCategoryId],
		references: [userCategories.id],
		relationName: "categoryRules_toCategoryId_userCategories_id"
	}),
}));

export const userAddressesRelations = relations(userAddresses, ({many}) => ({
	orders: many(orders),
}));

export const userRecipientsRelations = relations(userRecipients, ({many}) => ({
	orders: many(orders),
}));

export const orderStatusesRelations = relations(orderStatuses, ({many}) => ({
	orders: many(orders),
}));

export const productPricesRelations = relations(productPrices, ({one}) => ({
	productModification: one(productModifications, {
		fields: [productPrices.modificationId],
		references: [productModifications.id]
	}),
	priceType: one(priceTypes, {
		fields: [productPrices.priceTypeId],
		references: [priceTypes.id]
	}),
	product: one(products, {
		fields: [productPrices.productId],
		references: [products.id]
	}),
}));

export const discountGroupsRelations = relations(discountGroups, ({one, many}) => ({
	discountGroup: one(discountGroups, {
		fields: [discountGroups.parentGroupId],
		references: [discountGroups.id],
		relationName: "discountGroups_parentGroupId_discountGroups_id"
	}),
	discountGroups: many(discountGroups, {
		relationName: "discountGroups_parentGroupId_discountGroups_id"
	}),
	discounts: many(discounts),
}));

export const discountTargetsRelations = relations(discountTargets, ({one}) => ({
	discount: one(discounts, {
		fields: [discountTargets.discountId],
		references: [discounts.id]
	}),
}));

export const discountsRelations = relations(discounts, ({one, many}) => ({
	discountTargets: many(discountTargets),
	discountConditions: many(discountConditions),
	discountGroup: one(discountGroups, {
		fields: [discounts.groupId],
		references: [discountGroups.id]
	}),
	priceType: one(priceTypes, {
		fields: [discounts.priceTypeId],
		references: [priceTypes.id]
	}),
}));

export const discountConditionsRelations = relations(discountConditions, ({one}) => ({
	discount: one(discounts, {
		fields: [discountConditions.discountId],
		references: [discounts.id]
	}),
}));

export const productReviewsRelations = relations(productReviews, ({one}) => ({
	product: one(products, {
		fields: [productReviews.productId],
		references: [products.id]
	}),
}));

export const bannersRelations = relations(banners, ({one}) => ({
	section: one(sections, {
		fields: [banners.sectionId],
		references: [sections.id]
	}),
}));