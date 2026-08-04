// Спільні примітиви домену. Без залежностей від БД чи runtime.

/** Рекурсивний JSON-тип (заміна Database['Json'], щоб не тягнути supabase). */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SortDir = 'asc' | 'desc';

/** Сторінкована вибірка для list-операцій репозиторіїв. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Базові параметри пагінації/сортування для запитів. */
export interface PageQuery {
  page?: number;
  pageSize?: number;
  sort?: { field: string; dir: SortDir };
}
