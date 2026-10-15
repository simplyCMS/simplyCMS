import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  AdminNotFoundError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import { advisoryXactLock, type ActorDb } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { languages } from 'simplycms/schema';
import type { Language } from 'simplycms/schema/types';
import { hasLanguagePack } from 'simplycms/site';

// Спільні схеми й хелпери операцій мов (М1, Task 6).

export const status = z.enum(['draft', 'published', 'disabled']);
export const code = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/);
export const view = z.object({
  code: z.string(),
  name: z.string(),
  status,
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  hasPack: z.boolean(),
});
type View = z.infer<typeof view>;

export const toView = (r: Language): View => ({
  code: r.code,
  name: r.name,
  status: r.status,
  isDefault: r.isDefault,
  sortOrder: r.sortOrder,
  hasPack: hasLanguagePack(r.code),
});

export async function load(db: ActorDb, c: string): Promise<Language> {
  const [row] = await db.select().from(languages).where(eq(languages.code, c));
  if (!row) throw new AdminNotFoundError('мова');
  return row;
}

/** Недопустиме значення поля за поточного стану (основна мова, заборонений перехід). */
export const invalid = (field: string) =>
  new ValidationError([{ path: [field], code: 'invalid_value' }]);

/**
 * Ексклюзивний замок набору мов — ПЕРШИЙ крок кожної операції, що пише в
 * `languages` (add, статус, reorder, remove). Творці адрес беруть його
 * спільним, тож зміна набору чекає їх і не ламає їхній коміт; правило тримає й
 * тригер БД `languages_require_lock` — забутий замок гучний, а не тихий.
 */
export const lockLanguageSet = (db: ActorDb): Promise<void> =>
  advisoryXactLock(db, LOCK_KEYS.languagesSet);
