/**
 * Рядок таблиці `plg_faq_items`. Таблиці плагінів свідомо НЕ входять у
 * core-baseline типів БД — тип тримає автор плагіна, узгодженість зі схемою
 * (migrations/20260814120000_plg_faq_items.sql) — його відповідальність.
 */
export interface FaqItem extends Record<string, unknown> {
  id: string;
  product_id: string | null;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
