// Контракти читань покупців для адмінки (К3-Е6г, Е6г-6). Лише типи.

/** Рядок списку покупців: `users LEFT JOIN profiles` (власник без профілю теж тут). */
export interface AdminCustomerRow {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  /** Ефективна категорія: профіль без явної категорії = дефолтна. */
  categoryId: string | null;
  categoryName: string | null;
  /** Замовлення, крім скасованих (та сама умова, що в `loadCustomerStats`). */
  ordersCount: number;
  ordersTotalCents: number;
  isAdmin: boolean;
  bannedAt: Date | null;
  createdAt: Date;
}

/** Курсор keyset-пагінації `(created_at desc, id desc)`. */
export interface AdminCustomerCursor {
  createdAt: Date;
  id: string;
}

export interface AdminCustomerPage {
  rows: AdminCustomerRow[];
  nextCursor: AdminCustomerCursor | null;
}

/** Запис історії категорій; назви — знімок на момент переведення. */
export interface AdminCategoryHistoryEntry {
  id: string;
  fromName: string | null;
  toName: string;
  reason: string | null;
  byRule: boolean;
  changedByEmail: string | null;
  createdAt: Date;
}

export interface AdminCustomerCard {
  userId: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: Date;
  avatarRef: string | null;
  authProviders: string[];
  utmSource: string | null;
  utmCampaign: string | null;
  /** `null` без профілю (власник, створений CLI). */
  stats: { ordersCount: number; totalPurchasesCents: number } | null;
  /** `null` без профілю. */
  category: { id: string; name: string; locked: boolean } | null;
  isAdmin: boolean;
  bannedAt: Date | null;
  banReason: string | null;
  /** Останні 50, новіші зверху. */
  history: AdminCategoryHistoryEntry[];
}
