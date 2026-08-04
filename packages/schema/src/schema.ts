import { pgTable, unique, pgPolicy, uuid, text, varchar, integer, boolean, timestamp, foreignKey, jsonb, check, numeric, index, uniqueIndex, time, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// 🔧 Ручна правка після `pull` (див. README): ціль зовнішніх ключів `auth.users`.
// Імпортуємо БЕЗ реекспорту — деталі в `./auth-users.ts`.
import { usersInAuth } from "./auth-users";

export const appRole = pgEnum("app_role", ['admin', 'user'])
export const discountGroupOperator = pgEnum("discount_group_operator", ['and', 'or', 'not', 'min', 'max'])
export const discountTargetType = pgEnum("discount_target_type", ['product', 'modification', 'section', 'all'])
export const discountType = pgEnum("discount_type", ['percent', 'fixed_amount', 'fixed_price'])
export const propertyType = pgEnum("property_type", ['text', 'number', 'select', 'multiselect', 'range', 'color', 'boolean'])
export const shippingCalculationType = pgEnum("shipping_calculation_type", ['flat', 'weight', 'order_total', 'free_from', 'plugin'])
export const shippingMethodType = pgEnum("shipping_method_type", ['system', 'manual', 'plugin'])
export const stockStatus = pgEnum("stock_status", ['in_stock', 'out_of_stock', 'on_order'])


export const orderStatuses = pgTable("order_statuses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	code: varchar({ length: 50 }).notNull(),
	color: varchar({ length: 7 }).default('#6B7280'),
	sortOrder: integer("sort_order").default(0).notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("order_statuses_code_key").on(table.code),
	pgPolicy("Order statuses are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage order statuses", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const sections = pgTable("sections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	description: text(),
	imageUrl: text("image_url"),
	parentId: uuid("parent_id"),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	metaTitle: text("meta_title"),
	metaDescription: text("meta_description"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "sections_parent_id_fkey"
		}),
	unique("sections_slug_key").on(table.slug),
	pgPolicy("Active sections are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`((is_active = true) OR is_admin())` }),
	pgPolicy("Admins can manage sections", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const sectionProperties = pgTable("section_properties", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sectionId: uuid("section_id"),
	name: text().notNull(),
	slug: varchar({ length: 100 }).notNull(),
	propertyType: propertyType("property_type").default('text').notNull(),
	isRequired: boolean("is_required").default(false).notNull(),
	isFilterable: boolean("is_filterable").default(false).notNull(),
	hasPage: boolean("has_page").default(false).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	options: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [sections.id],
			name: "section_properties_section_id_fkey"
		}).onDelete("cascade"),
	unique("section_properties_section_id_code_key").on(table.sectionId, table.slug),
	pgPolicy("Section properties are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage section properties", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const userCategories = pgTable("user_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	code: varchar({ length: 50 }).notNull(),
	description: text(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	priceTypeId: uuid("price_type_id"),
}, (table) => [
	foreignKey({
			columns: [table.priceTypeId],
			foreignColumns: [priceTypes.id],
			name: "user_categories_price_type_id_fkey"
		}).onDelete("set null"),
	unique("user_categories_code_key").on(table.code),
	pgPolicy("Categories are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can insert categories", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`is_admin()` }),
	pgPolicy("Admins can update categories", { as: "permissive", for: "update", to: ["public"], using: sql`is_admin()`, withCheck: sql`is_admin()` }),
	pgPolicy("Admins can delete categories", { as: "permissive", for: "delete", to: ["public"], using: sql`is_admin()` }),
]);

export const languages = pgTable("languages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 10 }).notNull(),
	name: text().notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("languages_code_key").on(table.code),
	pgPolicy("Languages are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage languages", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const userRoles = pgTable("user_roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	role: appRole().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "user_roles_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_roles_user_id_role_key").on(table.userId, table.role),
	pgPolicy("Users can view own roles", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Admins can manage roles", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const wishlists = pgTable("wishlists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	productId: uuid("product_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "wishlists_product_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "wishlists_user_id_fkey"
		}).onDelete("cascade"),
	unique("wishlists_user_id_product_id_key").on(table.userId, table.productId),
	pgPolicy("Users can view own wishlist", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can manage own wishlist", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can delete from wishlist", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const comparisons = pgTable("comparisons", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	productId: uuid("product_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "comparisons_product_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "comparisons_user_id_fkey"
		}).onDelete("cascade"),
	unique("comparisons_user_id_product_id_key").on(table.userId, table.productId),
	pgPolicy("Users can view own comparisons", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can manage own comparisons", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = user_id)` }),
	pgPolicy("Users can delete from comparisons", { as: "permissive", for: "delete", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const orderItems = pgTable("order_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	productId: uuid("product_id"),
	modificationId: uuid("modification_id"),
	serviceId: uuid("service_id"),
	name: text().notNull(),
	price: numeric({ precision: 12, scale:  2 }).notNull(),
	quantity: integer().default(1).notNull(),
	total: numeric({ precision: 12, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	basePrice: numeric("base_price"),
	discountData: jsonb("discount_data"),
}, (table) => [
	foreignKey({
			columns: [table.modificationId],
			foreignColumns: [productModifications.id],
			name: "order_items_modification_id_fkey"
		}),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "order_items_product_id_fkey"
		}),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [services.id],
			name: "order_items_service_id_fkey"
		}),
	pgPolicy("Users can create order items", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_items.order_id) AND ((orders.user_id = auth.uid()) OR (orders.user_id IS NULL)))))` }),
	pgPolicy("Admins can manage order items", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Users can view own order items", { as: "permissive", for: "select", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid()) AND (auth.uid() IS NOT NULL))))` }),
	check("order_items_positive_quantity", sql`quantity > 0`),
]);

export const modificationPropertyValues = pgTable("modification_property_values", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	modificationId: uuid("modification_id").notNull(),
	propertyId: uuid("property_id").notNull(),
	value: text(),
	numericValue: numeric("numeric_value"),
	optionId: uuid("option_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_modification_property_values_mod").using("btree", table.modificationId.asc().nullsLast().op("uuid_ops")),
	index("idx_modification_property_values_option").using("btree", table.optionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modificationId],
			foreignColumns: [productModifications.id],
			name: "modification_property_values_modification_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.optionId],
			foreignColumns: [propertyOptions.id],
			name: "modification_property_values_option_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [sectionProperties.id],
			name: "modification_property_values_property_id_fkey"
		}).onDelete("cascade"),
	unique("modification_property_values_modification_id_property_id_key").on(table.modificationId, table.propertyId),
	pgPolicy("Modification property values are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage modification property values", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const productPropertyValues = pgTable("product_property_values", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	propertyId: uuid("property_id").notNull(),
	value: text(),
	numericValue: numeric("numeric_value", { precision: 15, scale:  4 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	optionId: uuid("option_id"),
}, (table) => [
	index("idx_product_property_values_option_id").using("btree", table.optionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.optionId],
			foreignColumns: [propertyOptions.id],
			name: "product_property_values_option_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_property_values_product_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [sectionProperties.id],
			name: "product_property_values_property_id_fkey"
		}).onDelete("cascade"),
	unique("product_property_values_product_id_property_id_key").on(table.productId, table.propertyId),
	pgPolicy("Property values are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage property values", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const propertyOptions = pgTable("property_options", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	propertyId: uuid("property_id").notNull(),
	name: text().notNull(),
	slug: varchar({ length: 255 }).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	description: text(),
	imageUrl: text("image_url"),
	metaTitle: text("meta_title"),
	metaDescription: text("meta_description"),
}, (table) => [
	index("idx_property_options_property_id").using("btree", table.propertyId.asc().nullsLast().op("uuid_ops")),
	index("idx_property_options_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [sectionProperties.id],
			name: "property_options_property_id_fkey"
		}).onDelete("cascade"),
	unique("property_options_property_id_slug_key").on(table.propertyId, table.slug),
	pgPolicy("Property options are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage property options", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const sectionPropertyAssignments = pgTable("section_property_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sectionId: uuid("section_id").notNull(),
	propertyId: uuid("property_id").notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliesTo: text("applies_to").default('product').notNull(),
}, (table) => [
	index("idx_section_property_assignments_property").using("btree", table.propertyId.asc().nullsLast().op("uuid_ops")),
	index("idx_section_property_assignments_section").using("btree", table.sectionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [sectionProperties.id],
			name: "section_property_assignments_property_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [sections.id],
			name: "section_property_assignments_section_id_fkey"
		}).onDelete("cascade"),
	unique("section_property_assignments_section_id_property_id_key").on(table.sectionId, table.propertyId),
	pgPolicy("Section property assignments are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage section property assignments", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	check("section_property_assignments_applies_to_check", sql`applies_to = ANY (ARRAY['product'::text, 'modification'::text])`),
]);

export const services = pgTable("services", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	description: text(),
	price: numeric({ precision: 12, scale:  2 }),
	isActive: boolean("is_active").default(true).notNull(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("services_slug_key").on(table.slug),
	pgPolicy("Active services are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`((is_active = true) OR is_admin())` }),
	pgPolicy("Admins can manage services", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	check("services_positive_price", sql`(price IS NULL) OR (price >= (0)::numeric)`),
]);

export const products = pgTable("products", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sectionId: uuid("section_id"),
	slug: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	shortDescription: text("short_description"),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	isFeatured: boolean("is_featured").default(false).notNull(),
	metaTitle: text("meta_title"),
	metaDescription: text("meta_description"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	images: jsonb().default([]),
	hasModifications: boolean("has_modifications").default(true),
	sku: varchar(),
	stockStatus: stockStatus("stock_status").default('in_stock'),
}, (table) => [
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [sections.id],
			name: "products_section_id_fkey"
		}).onDelete("set null"),
	unique("products_slug_key").on(table.slug),
	pgPolicy("Active products are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`((is_active = true) OR is_admin())` }),
	pgPolicy("Admins can manage products", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const productModifications = pgTable("product_modifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	slug: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	sku: varchar({ length: 100 }),
	isDefault: boolean("is_default").default(false).notNull(),
	images: jsonb().default([]),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	stockStatus: stockStatus("stock_status").default('in_stock'),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_modifications_product_id_fkey"
		}).onDelete("cascade"),
	unique("product_modifications_product_slug_unique").on(table.productId, table.slug),
	pgPolicy("Modifications are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage modifications", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const serviceRequests = pgTable("service_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	serviceId: uuid("service_id"),
	userId: uuid("user_id"),
	name: text().notNull(),
	email: text().notNull(),
	phone: text(),
	message: text(),
	status: varchar({ length: 50 }).default('new').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [services.id],
			name: "service_requests_service_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "service_requests_user_id_fkey"
		}),
	pgPolicy("Anyone can create service requests", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`true` }),
	pgPolicy("Admins can manage service requests", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Users can view own service requests", { as: "permissive", for: "select", to: ["public"], using: sql`(((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR is_admin())` }),
	check("service_requests_message_length", sql`(char_length(message) <= 10000) OR (message IS NULL)`),
]);

export const pluginEvents = pgTable("plugin_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	pluginName: varchar("plugin_name").notNull(),
	hookName: varchar("hook_name").notNull(),
	payload: jsonb(),
	result: jsonb(),
	error: text(),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	pgPolicy("Admins can manage plugin events", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Plugin events are viewable by admins", { as: "permissive", for: "select", to: ["public"], using: sql`is_admin()` }),
]);

export const plugins = pgTable("plugins", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar().notNull(),
	displayName: text("display_name").notNull(),
	version: varchar().default('1.0.0').notNull(),
	description: text(),
	author: text(),
	isActive: boolean("is_active").default(false),
	config: jsonb().default({}),
	hooks: jsonb().default([]),
	migrationsApplied: jsonb("migrations_applied").default([]),
	installedAt: timestamp("installed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("plugins_name_key").on(table.name),
	pgPolicy("Admins can manage plugins", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Plugins are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const shippingMethods = pgTable("shipping_methods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: text().notNull(),
	description: text(),
	type: shippingMethodType().default('manual').notNull(),
	pluginName: varchar("plugin_name", { length: 100 }),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	config: jsonb().default({}),
	icon: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("shipping_methods_code_key").on(table.code),
	pgPolicy("Shipping methods are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`((is_active = true) OR is_admin())` }),
	pgPolicy("Admins can manage shipping methods", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const shippingZones = pgTable("shipping_zones", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	isActive: boolean("is_active").default(true).notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	cities: text().array().default([""]),
	regions: text().array().default([""]),
}, (table) => [
	pgPolicy("Shipping zones are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`((is_active = true) OR is_admin())` }),
	pgPolicy("Admins can manage shipping zones", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const shippingRates = pgTable("shipping_rates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	methodId: uuid("method_id").notNull(),
	zoneId: uuid("zone_id").notNull(),
	name: text().notNull(),
	calculationType: shippingCalculationType("calculation_type").default('flat').notNull(),
	baseCost: numeric("base_cost", { precision: 10, scale:  2 }).default('0').notNull(),
	perKgCost: numeric("per_kg_cost", { precision: 10, scale:  2 }),
	minWeight: numeric("min_weight", { precision: 10, scale:  2 }),
	freeFromAmount: numeric("free_from_amount", { precision: 10, scale:  2 }),
	minOrderAmount: numeric("min_order_amount", { precision: 10, scale:  2 }),
	maxOrderAmount: numeric("max_order_amount", { precision: 10, scale:  2 }),
	estimatedDays: varchar("estimated_days", { length: 50 }),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	config: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_shipping_rates_method_id").using("btree", table.methodId.asc().nullsLast().op("uuid_ops")),
	index("idx_shipping_rates_zone_id").using("btree", table.zoneId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.methodId],
			foreignColumns: [shippingMethods.id],
			name: "shipping_rates_method_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.zoneId],
			foreignColumns: [shippingZones.id],
			name: "shipping_rates_zone_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Shipping rates are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`((is_active = true) OR is_admin())` }),
	pgPolicy("Admins can manage shipping rates", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const systemSettings = pgTable("system_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	key: varchar({ length: 100 }).notNull(),
	value: jsonb().default({}).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("system_settings_key_key").on(table.key),
	pgPolicy("Admins can manage system settings", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("System settings are viewable by admins", { as: "permissive", for: "select", to: ["public"], using: sql`is_admin()` }),
]);

export const pickupPoints = pgTable("pickup_points", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	methodId: uuid("method_id").notNull(),
	name: text().notNull(),
	address: text().notNull(),
	city: text().notNull(),
	zoneId: uuid("zone_id"),
	workingHours: jsonb("working_hours").default({}),
	phone: varchar({ length: 50 }),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	coordinates: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isSystem: boolean("is_system").default(false).notNull(),
}, (table) => [
	index("idx_pickup_points_city").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("idx_pickup_points_method_id").using("btree", table.methodId.asc().nullsLast().op("uuid_ops")),
	index("idx_pickup_points_zone_id").using("btree", table.zoneId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.methodId],
			foreignColumns: [shippingMethods.id],
			name: "pickup_points_method_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.zoneId],
			foreignColumns: [shippingZones.id],
			name: "pickup_points_zone_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Pickup points are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`((is_active = true) OR is_admin())` }),
	pgPolicy("Admins can manage pickup points", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const stockByPickupPoint = pgTable("stock_by_pickup_point", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	pickupPointId: uuid("pickup_point_id").notNull(),
	productId: uuid("product_id"),
	modificationId: uuid("modification_id"),
	quantity: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("unique_stock_modification_per_point").using("btree", table.pickupPointId.asc().nullsLast().op("uuid_ops"), table.modificationId.asc().nullsLast().op("uuid_ops")).where(sql`(modification_id IS NOT NULL)`),
	uniqueIndex("unique_stock_product_per_point").using("btree", table.pickupPointId.asc().nullsLast().op("uuid_ops"), table.productId.asc().nullsLast().op("uuid_ops")).where(sql`((product_id IS NOT NULL) AND (modification_id IS NULL))`),
	foreignKey({
			columns: [table.modificationId],
			foreignColumns: [productModifications.id],
			name: "stock_by_pickup_point_modification_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.pickupPointId],
			foreignColumns: [pickupPoints.id],
			name: "stock_by_pickup_point_pickup_point_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_by_pickup_point_product_id_fkey"
		}).onDelete("cascade"),
	unique("stock_by_pickup_point_pickup_point_id_product_id_modificati_key").on(table.pickupPointId, table.productId, table.modificationId),
	pgPolicy("Admins can manage stock", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Stock is viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	check("stock_product_or_modification", sql`((product_id IS NOT NULL) AND (modification_id IS NULL)) OR ((product_id IS NULL) AND (modification_id IS NOT NULL))`),
]);

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: text(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	phone: text(),
	categoryId: uuid("category_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	avatarUrl: text("avatar_url"),
	defaultShippingMethodId: uuid("default_shipping_method_id"),
	defaultPickupPointId: uuid("default_pickup_point_id"),
	authProvider: text("auth_provider"),
	registrationUtm: jsonb("registration_utm").default({}),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [userCategories.id],
			name: "profiles_category_id_fkey"
		}),
	foreignKey({
			columns: [table.defaultPickupPointId],
			foreignColumns: [pickupPoints.id],
			name: "profiles_default_pickup_point_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.defaultShippingMethodId],
			foreignColumns: [shippingMethods.id],
			name: "profiles_default_shipping_method_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "profiles_user_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_user_id_key").on(table.userId),
	pgPolicy("Users can view own profile", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
	pgPolicy("Admins can view all profiles", { as: "permissive", for: "select", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Admins can manage profiles", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Users can update own profile", { as: "permissive", for: "update", to: ["public"], using: sql`(auth.uid() = user_id)`, withCheck: sql`((auth.uid() = user_id) AND (NOT (category_id IS DISTINCT FROM ( SELECT p.category_id
   FROM profiles p
  WHERE (p.user_id = auth.uid())))))` }),
	check("profiles_name_length", sql`((char_length(first_name) <= 100) OR (first_name IS NULL)) AND ((char_length(last_name) <= 100) OR (last_name IS NULL))`),
]);

export const userCategoryHistory = pgTable("user_category_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	fromCategoryId: uuid("from_category_id"),
	toCategoryId: uuid("to_category_id").notNull(),
	reason: text(),
	ruleId: uuid("rule_id"),
	changedBy: uuid("changed_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.fromCategoryId],
			foreignColumns: [userCategories.id],
			name: "user_category_history_from_category_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.ruleId],
			foreignColumns: [categoryRules.id],
			name: "user_category_history_rule_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.toCategoryId],
			foreignColumns: [userCategories.id],
			name: "user_category_history_to_category_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Admins can manage category history", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Users can view own category history", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
]);

export const categoryRules = pgTable("category_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	fromCategoryId: uuid("from_category_id"),
	toCategoryId: uuid("to_category_id").notNull(),
	conditions: jsonb().default({"type":"all","rules":[]}).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	priority: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.fromCategoryId],
			foreignColumns: [userCategories.id],
			name: "category_rules_from_category_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.toCategoryId],
			foreignColumns: [userCategories.id],
			name: "category_rules_to_category_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Category rules are viewable by admins", { as: "permissive", for: "select", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Admins can insert category rules", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`is_admin()` }),
	pgPolicy("Admins can update category rules", { as: "permissive", for: "update", to: ["public"], using: sql`is_admin()`, withCheck: sql`is_admin()` }),
	pgPolicy("Admins can delete category rules", { as: "permissive", for: "delete", to: ["public"], using: sql`is_admin()` }),
]);

export const userRecipients = pgTable("user_recipients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	phone: text().notNull(),
	email: text(),
	city: text().notNull(),
	address: text().notNull(),
	notes: text(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	pgPolicy("Users can manage own recipients", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)`, withCheck: sql`(auth.uid() = user_id)` }),
	pgPolicy("Admins can view all recipients", { as: "permissive", for: "select", to: ["public"], using: sql`is_admin()` }),
]);

export const orders = pgTable("orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	orderNumber: varchar("order_number", { length: 50 }).notNull(),
	statusId: uuid("status_id"),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	deliveryAddress: text("delivery_address"),
	deliveryCity: text("delivery_city"),
	deliveryMethod: text("delivery_method"),
	paymentMethod: text("payment_method").notNull(),
	subtotal: numeric({ precision: 12, scale:  2 }).notNull(),
	total: numeric({ precision: 12, scale:  2 }).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	accessToken: text("access_token"),
	shippingMethodId: uuid("shipping_method_id"),
	shippingZoneId: uuid("shipping_zone_id"),
	shippingRateId: uuid("shipping_rate_id"),
	shippingCost: numeric("shipping_cost", { precision: 10, scale:  2 }).default('0'),
	pickupPointId: uuid("pickup_point_id"),
	shippingData: jsonb("shipping_data").default({}),
	hasDifferentRecipient: boolean("has_different_recipient").default(false).notNull(),
	recipientFirstName: text("recipient_first_name"),
	recipientLastName: text("recipient_last_name"),
	recipientPhone: text("recipient_phone"),
	recipientEmail: text("recipient_email"),
	savedRecipientId: uuid("saved_recipient_id"),
	savedAddressId: uuid("saved_address_id"),
}, (table) => [
	index("idx_orders_pickup_point_id").using("btree", table.pickupPointId.asc().nullsLast().op("uuid_ops")),
	index("idx_orders_shipping_method_id").using("btree", table.shippingMethodId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.pickupPointId],
			foreignColumns: [pickupPoints.id],
			name: "orders_pickup_point_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.savedAddressId],
			foreignColumns: [userAddresses.id],
			name: "orders_saved_address_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.savedRecipientId],
			foreignColumns: [userRecipients.id],
			name: "orders_saved_recipient_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.shippingMethodId],
			foreignColumns: [shippingMethods.id],
			name: "orders_shipping_method_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.shippingRateId],
			foreignColumns: [shippingRates.id],
			name: "orders_shipping_rate_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.shippingZoneId],
			foreignColumns: [shippingZones.id],
			name: "orders_shipping_zone_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.statusId],
			foreignColumns: [orderStatuses.id],
			name: "orders_status_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [usersInAuth.id],
			name: "orders_user_id_fkey"
		}),
	unique("orders_order_number_key").on(table.orderNumber),
	pgPolicy("Users can create orders", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`((auth.uid() = user_id) OR (user_id IS NULL))` }),
	pgPolicy("Admins can manage orders", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
	pgPolicy("Users can view own orders", { as: "permissive", for: "select", to: ["public"], using: sql`((auth.uid() IS NOT NULL) AND (auth.uid() = user_id))` }),
	check("orders_name_length", sql`(char_length(first_name) <= 100) AND (char_length(last_name) <= 100)`),
	check("orders_notes_length", sql`(char_length(notes) <= 5000) OR (notes IS NULL)`),
	check("orders_positive_totals", sql`(subtotal >= (0)::numeric) AND (total >= (0)::numeric)`),
]);

export const userAddresses = pgTable("user_addresses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	city: text().notNull(),
	address: text().notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	pgPolicy("Users can manage own addresses", { as: "permissive", for: "all", to: ["public"], using: sql`(auth.uid() = user_id)`, withCheck: sql`(auth.uid() = user_id)` }),
	pgPolicy("Admins can view all addresses", { as: "permissive", for: "select", to: ["public"], using: sql`is_admin()` }),
]);

export const productPrices = pgTable("product_prices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	priceTypeId: uuid("price_type_id").notNull(),
	productId: uuid("product_id").notNull(),
	modificationId: uuid("modification_id"),
	price: numeric().notNull(),
	oldPrice: numeric("old_price"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_product_prices_unique").using("btree", sql`price_type_id`, sql`product_id`, sql`COALESCE(modification_id, '00000000-0000-0000-0000-000000000000'::uuid)`),
	foreignKey({
			columns: [table.modificationId],
			foreignColumns: [productModifications.id],
			name: "product_prices_modification_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.priceTypeId],
			foreignColumns: [priceTypes.id],
			name: "product_prices_price_type_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_prices_product_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Anyone can view product prices", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage product prices", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()`, withCheck: sql`is_admin()` }),
]);

export const themes = pgTable("themes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	displayName: text("display_name").notNull(),
	version: varchar({ length: 20 }).default('1.0.0').notNull(),
	description: text(),
	author: text(),
	previewImage: text("preview_image"),
	isActive: boolean("is_active").default(false).notNull(),
	settings: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("themes_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	unique("themes_name_key").on(table.name),
	pgPolicy("Themes are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage themes", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const priceTypes = pgTable("price_types", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	code: varchar().notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_price_types_single_default").using("btree", table.isDefault.asc().nullsLast().op("bool_ops")).where(sql`(is_default = true)`),
	unique("price_types_code_key").on(table.code),
	pgPolicy("Anyone can view price types", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage price types", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()`, withCheck: sql`is_admin()` }),
]);

export const discountGroups = pgTable("discount_groups", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	operator: discountGroupOperator().default('and').notNull(),
	parentGroupId: uuid("parent_group_id"),
	isActive: boolean("is_active").default(true).notNull(),
	priority: integer().default(0).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_discount_groups_parent").using("btree", table.parentGroupId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.parentGroupId],
			foreignColumns: [table.id],
			name: "discount_groups_parent_group_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Anyone can view active discount groups", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage discount groups", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const discountTargets = pgTable("discount_targets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	discountId: uuid("discount_id").notNull(),
	targetType: discountTargetType("target_type").default('all').notNull(),
	targetId: uuid("target_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_discount_targets_discount").using("btree", table.discountId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.discountId],
			foreignColumns: [discounts.id],
			name: "discount_targets_discount_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Anyone can view discount targets", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage discount targets", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const discountConditions = pgTable("discount_conditions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	discountId: uuid("discount_id").notNull(),
	conditionType: varchar("condition_type").notNull(),
	operator: varchar().default('=').notNull(),
	value: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_discount_conditions_discount").using("btree", table.discountId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.discountId],
			foreignColumns: [discounts.id],
			name: "discount_conditions_discount_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Anyone can view discount conditions", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage discount conditions", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const discounts = pgTable("discounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	groupId: uuid("group_id").notNull(),
	discountType: discountType("discount_type").default('percent').notNull(),
	discountValue: numeric("discount_value").notNull(),
	priority: integer().default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	priceTypeId: uuid("price_type_id").notNull(),
}, (table) => [
	index("idx_discounts_group").using("btree", table.groupId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [discountGroups.id],
			name: "discounts_group_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.priceTypeId],
			foreignColumns: [priceTypes.id],
			name: "discounts_price_type_id_fkey"
		}),
	pgPolicy("Anyone can view active discounts", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Admins can manage discounts", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()` }),
]);

export const productReviews = pgTable("product_reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	productId: uuid("product_id").notNull(),
	userId: uuid("user_id").notNull(),
	rating: integer().notNull(),
	title: text(),
	content: text(),
	images: jsonb().default([]),
	status: text().default('pending').notNull(),
	adminComment: text("admin_comment"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_reviews_product_id_fkey"
		}).onDelete("cascade"),
	unique("product_reviews_product_id_user_id_key").on(table.productId, table.userId),
	pgPolicy("Anyone can view approved reviews", { as: "permissive", for: "select", to: ["public"], using: sql`((status = 'approved'::text) OR (user_id = auth.uid()) OR is_admin())` }),
	pgPolicy("Authenticated users can create reviews", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`((auth.uid() IS NOT NULL) AND (user_id = auth.uid()))` }),
	pgPolicy("Authors can update pending reviews", { as: "permissive", for: "update", to: ["public"], using: sql`(((user_id = auth.uid()) AND (status = 'pending'::text)) OR is_admin())` }),
	pgPolicy("Authors and admins can delete reviews", { as: "permissive", for: "delete", to: ["public"], using: sql`((user_id = auth.uid()) OR is_admin())` }),
]);

export const banners = pgTable("banners", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	subtitle: text(),
	imageUrl: text("image_url").notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	placement: text().default('home').notNull(),
	sectionId: uuid("section_id"),
	buttons: jsonb().default([]),
	dateFrom: timestamp("date_from", { withTimezone: true, mode: 'string' }),
	dateTo: timestamp("date_to", { withTimezone: true, mode: 'string' }),
	scheduleDays: integer("schedule_days").array(),
	scheduleTimeFrom: time("schedule_time_from"),
	scheduleTimeTo: time("schedule_time_to"),
	slideDuration: integer("slide_duration").default(5000).notNull(),
	animationType: text("animation_type").default('slide').notNull(),
	animationDuration: integer("animation_duration").default(500).notNull(),
	overlayColor: text("overlay_color").default('rgba(0,0,0,0.4)'),
	textPosition: text("text_position").default('left').notNull(),
	desktopImageUrl: text("desktop_image_url"),
	mobileImageUrl: text("mobile_image_url"),
}, (table) => [
	index("idx_banners_placement").using("btree", table.placement.asc().nullsLast().op("text_ops")),
	index("idx_banners_section_id").using("btree", table.sectionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [sections.id],
			name: "banners_section_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Anyone can view active banners", { as: "permissive", for: "select", to: ["public"], using: sql`(is_active = true)` }),
	pgPolicy("Admins can manage banners", { as: "permissive", for: "all", to: ["public"], using: sql`is_admin()`, withCheck: sql`is_admin()` }),
]);
