import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { products } from 'simplycms/schema';
import type { ActorDb } from './db';
import {
  homeProductColumns,
  toHomeProduct,
  type HomeProductRow,
} from './entities/home-product';
import type { SectionRef } from './entities/section';

/** Скільки товарів показує карусель одного розділу на головній. */
const PER_SECTION_LIMIT = 8;

/**
 * Товари кореневих розділів: `sectionId → перші N товарів`.
 *
 * 🔴 ОДИН запит на всі розділи, а не запит на розділ. Попередня реалізація
 * робила `limit(8)` окремим запитом на кожен розділ, бо per-section limit не
 * виражається в PostgREST — тобто N+1 був не недоглядом, а обмеженням
 * протоколу. У SQL це віконна функція: нумеруємо товари всередині розділу й
 * відрізаємо хвіст. Ціна головної перестала залежати від кількості розділів.
 */
export async function loadSectionProducts(
  db: ActorDb,
  sections: SectionRef[],
): Promise<Record<string, HomeProductRow[]>> {
  const bySection: Record<string, HomeProductRow[]> = {};
  for (const section of sections) bySection[section.id] = [];

  const sectionIds = sections.map((section) => section.id);
  // `inArray` з порожнім списком drizzle перетворює на `false` — запит був би
  // коректним, але марним походом у БД.
  if (sectionIds.length === 0) return bySection;

  const ranked = db
    .select({
      ...homeProductColumns,
      section_id: products.sectionId,
      position: sql<number>`
        row_number() over (
          partition by ${products.sectionId} order by ${products.createdAt} desc
        )
      `.as('position'),
    })
    .from(products)
    // Предикат видимості — див. коментар у `./sections`.
    .where(
      and(eq(products.isActive, true), inArray(products.sectionId, sectionIds)),
    )
    .as('ranked');

  const rows = await db
    .select()
    .from(ranked)
    .where(lte(ranked.position, PER_SECTION_LIMIT))
    .orderBy(ranked.section_id, ranked.position);

  const slugById = new Map(sections.map((s) => [s.id, s.slug]));
  for (const row of rows) {
    if (row.section_id === null) continue;
    const bucket = bySection[row.section_id];
    if (!bucket) continue;
    bucket.push(toHomeProduct(row, slugById.get(row.section_id) ?? null));
  }

  return bySection;
}
