import { and, asc, eq, isNull } from 'drizzle-orm';
import { sections } from 'simplycms/schema';
import type { ActorDb } from './db';
import {
  sectionColumns,
  sectionRefColumns,
  type SectionRef,
  type SectionRow,
} from './entities/section';

/**
 * 🔴 `is_active` фільтрується КОДОМ, а не базою, і так тепер скрізь у вітрині.
 * У моделі безпеки B5″ на каталозі немає RLS: роль `app_user` має SELECT на
 * всю таблицю, бо «активність» — правило показу, а не право доступу. Отже
 * забутий предикат тут не дасть помилки — він тихо виведе чернетки в магазин.
 */
export async function loadSections(db: ActorDb): Promise<SectionRow[]> {
  return db
    .select(sectionColumns)
    .from(sections)
    .where(eq(sections.isActive, true))
    .orderBy(asc(sections.sortOrder));
}

/** Розділ за slug — лише активний (див. коментар про видимість вище). */
export async function loadSectionBySlug(
  db: ActorDb,
  slug: string,
): Promise<SectionRow | null> {
  const [row] = await db
    .select(sectionColumns)
    .from(sections)
    .where(and(eq(sections.slug, slug), eq(sections.isActive, true)))
    .limit(1);

  return row ?? null;
}

/** Кореневі розділи (без батька) для навігації й добірок головної. */
export async function loadRootSections(db: ActorDb): Promise<SectionRef[]> {
  return db
    .select(sectionRefColumns)
    .from(sections)
    .where(and(eq(sections.isActive, true), isNull(sections.parentId)))
    .orderBy(asc(sections.sortOrder));
}
