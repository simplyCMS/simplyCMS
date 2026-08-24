import { sections } from 'simplycms/schema';
import type { Section } from 'simplycms/schema/types';

/**
 * Мапа select-а розділу: ключ — імʼя колонки в БД, значення — колонка Drizzle.
 *
 * 🔴 Ключі саме snake_case, а не camelCase Drizzle-схеми. Сторінки вітрини
 * читають розділ як плоский рядок БД (`id`, `is_active`, `sort_order`), і
 * перейменування полів було б окремою міграцією всього UI, а не побічним
 * ефектом переходу на Drizzle.
 */
export const sectionColumns = {
  id: sections.id,
  slug: sections.slug,
  name: sections.name,
  description: sections.description,
  image_url: sections.imageUrl,
  parent_id: sections.parentId,
  sort_order: sections.sortOrder,
  is_active: sections.isActive,
  meta_title: sections.metaTitle,
  meta_description: sections.metaDescription,
  created_at: sections.createdAt,
  updated_at: sections.updatedAt,
};

/** Повний рядок розділу. Типи полів — з Drizzle-схеми, не з генерату PostgREST. */
export type SectionRow = {
  id: Section['id'];
  slug: Section['slug'];
  name: Section['name'];
  description: Section['description'];
  image_url: Section['imageUrl'];
  parent_id: Section['parentId'];
  sort_order: Section['sortOrder'];
  is_active: Section['isActive'];
  meta_title: Section['metaTitle'];
  meta_description: Section['metaDescription'];
  created_at: Section['createdAt'];
  updated_at: Section['updatedAt'];
};

/** Скорочений розділ для навігації й добірок головної. */
export const sectionRefColumns = {
  id: sections.id,
  name: sections.name,
  slug: sections.slug,
};

export type SectionRef = {
  id: Section['id'];
  name: Section['name'];
  slug: Section['slug'];
};
