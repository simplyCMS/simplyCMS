// Мапери рядків Supabase → доменні об'єкти @simplysoftua/objects.
// Тримаємо межу: БД-схема не протікає в домен.

import type {
  Product,
  ProductModification,
  Section,
  Property,
  PropertyOption,
  PriceType,
  PriceEntry,
  StockStatus,
  Order,
  OrderItem,
  DiscountGroup,
  DiscountType,
  GroupOperator,
} from "@simplysoftua/objects";

// Рядки БД описуємо мінімально-необхідним чином (permissive),
// бо складні nested-select повертають широкі типи.
type Row = Record<string, unknown>;

function asStockStatus(v: unknown): StockStatus | null {
  return v === "in_stock" || v === "out_of_stock" || v === "on_order"
    ? v
    : null;
}

export function mapModification(row: Row): ProductModification {
  return {
    id: String(row.id),
    sku: (row.sku as string | null) ?? null,
    stock_status: asStockStatus(row.stock_status),
    is_default: Boolean(row.is_default),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export function mapPrice(row: Row): PriceEntry {
  return {
    price_type_id: String(row.price_type_id),
    price: Number(row.price),
    old_price: row.old_price == null ? null : Number(row.old_price),
    modification_id: (row.modification_id as string | null) ?? null,
  };
}

export function mapProduct(row: Row): Product {
  const mods = Array.isArray(row.product_modifications)
    ? (row.product_modifications as Row[]).map(mapModification)
    : [];
  const prices = Array.isArray(row.product_prices)
    ? (row.product_prices as Row[]).map(mapPrice)
    : [];
  const images = Array.isArray(row.images)
    ? (row.images as unknown[]).map(String)
    : [];

  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    section_id: (row.section_id as string | null) ?? null,
    stock_status: asStockStatus(row.stock_status),
    has_modifications: Boolean(row.has_modifications ?? mods.length > 0),
    modifications: mods,
    prices,
    images,
    isAvailable: row.isAvailable as boolean | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export function mapSection(row: Row): Section {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    parent_id: (row.parent_id as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    is_active: Boolean(row.is_active ?? true),
  };
}

export function mapPropertyOption(row: Row): PropertyOption {
  return {
    id: String(row.id),
    property_id: String(row.property_id),
    value: String(row.name ?? row.value ?? ""),
    sort_order: Number(row.sort_order ?? 0),
  };
}

export function mapProperty(row: Row): Property {
  const options = Array.isArray(row.property_options)
    ? (row.property_options as Row[]).map(mapPropertyOption)
    : undefined;
  return {
    id: String(row.id),
    code: String(row.slug ?? row.code ?? ""),
    name: String(row.name ?? ""),
    type: String(row.property_type ?? row.type ?? "text"),
    is_filterable: Boolean(row.is_filterable),
    sort_order: Number(row.sort_order ?? 0),
    options,
  };
}

export function mapPriceType(row: Row): PriceType {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    is_default: Boolean(row.is_default),
  };
}

export function mapOrderItem(row: Row): OrderItem {
  return {
    productId: String(row.product_id ?? ""),
    modificationId: (row.modification_id as string | null) ?? null,
    name: String(row.name ?? ""),
    quantity: Number(row.quantity ?? 0),
    price: Number(row.price ?? 0),
  };
}

export function mapOrder(row: Row): Order {
  const statusRow = row.order_statuses as Row | null | undefined;
  const items = Array.isArray(row.order_items)
    ? (row.order_items as Row[]).map(mapOrderItem)
    : Array.isArray(row.items)
      ? (row.items as Row[]).map(mapOrderItem)
      : [];

  return {
    id: String(row.id),
    number: String(row.order_number ?? ""),
    status: String(statusRow?.code ?? statusRow?.name ?? row.status_id ?? ""),
    customer: {
      name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
      email: (row.email as string | null) ?? null,
      phone: String(row.phone ?? ""),
    },
    items,
    subtotal: Number(row.subtotal ?? 0),
    shippingCost: Number(row.shipping_cost ?? 0),
    total: Number(row.total ?? 0),
    shipping: row.shipping_method_id
      ? {
          methodId: String(row.shipping_method_id),
          rateId: (row.shipping_rate_id as string | null) ?? null,
          pickupPointId: (row.pickup_point_id as string | null) ?? null,
          city: (row.delivery_city as string | null) ?? null,
          address: (row.delivery_address as string | null) ?? null,
        }
      : null,
    comment: (row.notes as string | null) ?? null,
    userId: (row.user_id as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
  };
}

/**
 * Будує дерево груп знижок із плоских рядків discounts + discount_groups.
 * Перенесено з core/hooks/useDiscountedPrice (data-частина).
 */
export function buildDiscountTree(
  dbDiscounts: Row[],
  allGroups: Row[],
): DiscountGroup[] {
  const groupMap = new Map<string, DiscountGroup>();

  for (const g of allGroups) {
    groupMap.set(String(g.id), {
      id: String(g.id),
      name: String(g.name ?? ""),
      description: (g.description as string | null) ?? null,
      operator: g.operator as GroupOperator,
      is_active: Boolean(g.is_active),
      priority: Number(g.priority ?? 0),
      starts_at: (g.starts_at as string | null) ?? null,
      ends_at: (g.ends_at as string | null) ?? null,
      discounts: [],
      children: [],
    });
  }

  for (const d of dbDiscounts) {
    const group = groupMap.get(String(d.group_id));
    if (group) {
      group.discounts.push({
        id: String(d.id),
        name: String(d.name ?? ""),
        description: (d.description as string | null) ?? null,
        discount_type: d.discount_type as DiscountType,
        discount_value: Number(d.discount_value),
        priority: Number(d.priority ?? 0),
        is_active: Boolean(d.is_active),
        starts_at: (d.starts_at as string | null) ?? null,
        ends_at: (d.ends_at as string | null) ?? null,
        targets: (d.discount_targets as DiscountGroup["discounts"][number]["targets"]) || [],
        conditions:
          (d.discount_conditions as DiscountGroup["discounts"][number]["conditions"]) || [],
      });
    }
  }

  const roots: DiscountGroup[] = [];
  for (const g of allGroups) {
    const node = groupMap.get(String(g.id));
    if (!node) continue;
    const parentId = g.parent_group_id as string | null;
    if (parentId && groupMap.has(parentId)) {
      groupMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
