import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  productModifications,
  productPrices,
  products,
  sections,
} from 'simplycms/schema';
import type { PriceEntry } from 'simplycms/contracts';
import type { ActorDb } from './db';
import { toImageList } from './entities/product';
import { listModificationColumns } from './entities/modification';
import { groupPricesByProduct, priceColumns } from './entities/price';

/** Модифікація в рядку списку — рівно те, чим обирається ціна за замовчуванням. */
export interface ProductListModification {
  id: string;
  is_default: boolean;
  sort_order: number;
}

/**
 * Рядок списку каталогу. Вузький навмисно: назовні їде вже DTO
 * (`toProductListItem`), тож повний товар тут був би трафіком у нікуди.
 */
export interface ProductListRow {
  id: string;
  slug: string;
  name: string;
  images: string[];
  has_modifications: boolean | null;
  sections: { slug: string } | null;
  product_modifications: ProductListModification[];
  product_prices: PriceEntry[];
}

/**
 * Список товарів каталогу — цілком або звужений розділом.
 *
 * 🔴 Три запити, а не запит на товар: модифікації й ціни тягнуться одним
 * `inArray` по всіх знайдених товарах. Так само свідомо НЕ один запит із
 * join-ом: join на дві колекції розмножив би рядки товару m×n, і збирати їх
 * назад довелося б у памʼяті — тобто той самий обсяг роботи, але з дублями
 * у відповіді БД.
 *
 * 🔴 `is_active = true` — обовʼязковий предикат видимості (пояснення — у
 * `./sections`). Розділ у фільтрі не робить його зайвим: неактивний товар
 * лишається в активному розділі.
 */
export async function loadProductList(
  db: ActorDb,
  sectionId?: string,
): Promise<ProductListRow[]> {
  const visible = sectionId
    ? and(eq(products.isActive, true), eq(products.sectionId, sectionId))
    : eq(products.isActive, true);

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      images: products.images,
      has_modifications: products.hasModifications,
      section_slug: sections.slug,
    })
    .from(products)
    .leftJoin(sections, eq(products.sectionId, sections.id))
    .where(visible)
    .orderBy(desc(products.createdAt));

  if (rows.length === 0) return [];

  // 🔴 Запити ПОСЛІДОВНІ, а не `Promise.all`. Транзакція живе на ОДНОМУ
  // зʼєднанні, тож паралелити нічого: драйвер усе одно вишикує їх у чергу,
  // а `pg` таке використання вже позначив застарілим (прибирається в pg@9).
  const ids = rows.map((row) => row.id);
  const modificationRows = await db
    .select(listModificationColumns)
    .from(productModifications)
    .where(inArray(productModifications.productId, ids));
  const priceRows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(inArray(productPrices.productId, ids));

  const modificationsByProduct: Record<string, ProductListModification[]> = {};
  for (const modification of modificationRows) {
    (modificationsByProduct[modification.product_id] ??= []).push({
      id: modification.id,
      is_default: modification.is_default,
      sort_order: modification.sort_order,
    });
  }
  const pricesByProduct = groupPricesByProduct(priceRows);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    images: toImageList(row.images),
    has_modifications: row.has_modifications,
    sections: row.section_slug === null ? null : { slug: row.section_slug },
    product_modifications: modificationsByProduct[row.id] ?? [],
    product_prices: pricesByProduct[row.id] ?? [],
  }));
}
