// Доменна сутність користувача (відв'язана від supabase Auth User).

export interface Identity {
  id: string;
  email: string | null;
  roles: string[];
  /** Категорія користувача (впливає на ціни/знижки). */
  categoryId: string | null;
  metadata?: Record<string, unknown>;
}
