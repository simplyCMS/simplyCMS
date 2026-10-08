// Контракт зведення дашборду адмінки (К3-Е6г, Е6г-5/Е6г-12). Лише типи.

export interface AdminDashboardRecentOrder {
  id: string;
  orderNumber: string;
  /** `null` у замовлення зі стертими персональними даними. */
  customerName: string | null;
  erased: boolean;
  totalCents: number;
  statusId: string | null;
  createdAt: Date;
}

export interface AdminDashboardSummary {
  newOrders: number;
  /** `id` статусу з кодом `new` — для глибокого посилання у фільтр замовлень. */
  newStatusId: string | null;
  revenue7dCents: number;
  revenue30dCents: number;
  recentOrders: AdminDashboardRecentOrder[];
}

/** Форма `context.stats` слота `admin.dashboard.stats`. */
export type AdminDashboardStats = Pick<
  AdminDashboardSummary,
  'newOrders' | 'revenue7dCents' | 'revenue30dCents'
>;
