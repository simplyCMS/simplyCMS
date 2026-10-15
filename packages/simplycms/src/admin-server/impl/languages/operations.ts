import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  AdminNotFoundError,
  InUseError,
  ValidationError,
} from 'simplycms/contracts/domain-errors';
import {
  advisoryXactLock,
  isForeignKeyViolation,
  type ActorDb,
} from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import { defineOperation } from 'simplycms/operations';
import { languages } from 'simplycms/schema';
import type { Language } from 'simplycms/schema/types';
import {
  CACHE_KEYS,
  bumpCacheGeneration,
  hasLanguagePack,
} from 'simplycms/site';
import { completeness } from './completeness';
import { FILL_BATCH, fillBatch } from './fill';

// Операції мов (М1, Task 6): перші живі споживачі реєстру операцій. Усі під
// `settings.manage` (Д5). Машина станів — майстер §3.5; інваріанти основної мови
// тримає БД (`languages_guard`), операції лише дають зрозумілі відмови.

const status = z.enum(['draft', 'published', 'disabled']);
const code = z.string().regex(/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/);
const view = z.object({
  code: z.string(),
  name: z.string(),
  status,
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  hasPack: z.boolean(),
});
type View = z.infer<typeof view>;

const toView = (r: Language): View => ({
  code: r.code,
  name: r.name,
  status: r.status,
  isDefault: r.isDefault,
  sortOrder: r.sortOrder,
  hasPack: hasLanguagePack(r.code),
});

async function load(db: ActorDb, c: string): Promise<Language> {
  const [row] = await db.select().from(languages).where(eq(languages.code, c));
  if (!row) throw new AdminNotFoundError('мова');
  return row;
}

/** Дозволені переходи не-основної мови (§3.5); основна не переходить ніде. */
const TRANSITIONS: Readonly<Record<Language['status'], readonly string[]>> = {
  draft: ['published', 'disabled'],
  published: ['disabled'],
  disabled: ['draft', 'published'],
};

const invalid = (field: string) =>
  new ValidationError([{ path: [field], code: 'invalid_value' }]);

export const languagesList = defineOperation({
  id: 'languages.list',
  permission: 'settings.manage',
  input: z.object({}),
  output: z.array(view),
  async run({ db }) {
    const rows = await db
      .select()
      .from(languages)
      .orderBy(asc(languages.sortOrder), asc(languages.code));
    return rows.map(toView);
  },
});

export const languagesAdd = defineOperation({
  id: 'languages.add',
  permission: 'settings.manage',
  input: z.object({
    id: z.uuid(),
    code,
    name: z.string().trim().min(1).max(100),
  }),
  output: view,
  async run({ db }, input) {
    // Ексклюзивно ПЕРШИМ запитом: чекаємо транзакції, що створюють адреси під
    // спільним замком, і бачимо всі їхні закомічені сутності (Review Focus 1).
    await advisoryXactLock(db, LOCK_KEYS.languagesSet);
    const next = await db.execute<{ n: number }>(
      sql`select coalesce(max(sort_order), 0) + 1 as n from public.languages`,
    );
    const [row] = await db
      .insert(languages)
      .values({
        id: input.id,
        code: input.code,
        name: input.name,
        status: 'draft',
        isDefault: false,
        sortOrder: Number(next.rows[0]?.n ?? 1),
      })
      .returning();
    await bumpCacheGeneration(db, CACHE_KEYS.languages);
    return toView(row!);
  },
});

export const languagesSetStatus = defineOperation({
  id: 'languages.setStatus',
  permission: 'settings.manage',
  input: z.object({ code, status }),
  output: view,
  async run({ db }, input) {
    // Публікація — під ексклюзивним замком: повноту міряємо, коли жодна
    // транзакція з адресами ще не закомічується.
    if (input.status === 'published')
      await advisoryXactLock(db, LOCK_KEYS.languagesSet);
    const row = await load(db, input.code);
    if (row.status === input.status) return toView(row);
    if (row.isDefault || !TRANSITIONS[row.status].includes(input.status))
      throw invalid('status');
    if (input.status === 'published') {
      const c = await completeness(db, input.code);
      if (!c.complete)
        throw new ValidationError([
          { path: ['status'], code: 'language_incomplete' },
        ]);
    }
    const [updated] = await db
      .update(languages)
      .set({ status: input.status })
      .where(eq(languages.code, input.code))
      .returning();
    await bumpCacheGeneration(db, CACHE_KEYS.languages);
    return toView(updated!);
  },
});

export const languagesFill = defineOperation({
  id: 'languages.fill',
  permission: 'settings.manage',
  input: z.object({
    code,
    batch: z.number().int().min(1).max(2000).default(FILL_BATCH),
  }),
  output: z.object({ inserted: z.number().int(), done: z.boolean() }),
  async run({ db }, input) {
    await load(db, input.code);
    // Рядок мови не змінюється, тож покоління кешу мов не піднімаємо.
    return fillBatch(db, input.code, input.batch);
  },
});

export const languagesReorder = defineOperation({
  id: 'languages.reorder',
  permission: 'settings.manage',
  input: z.object({ codes: z.array(code).min(1).max(200) }),
  output: z.array(view),
  async run({ db }, input) {
    // Порядок задається ЦІЛИМ набором: частковий лишив би невказані мови зі
    // старими номерами, які збіглися б з новими.
    const total = await db.select({ c: languages.code }).from(languages);
    if (
      new Set(input.codes).size !== input.codes.length ||
      input.codes.length !== total.length
    )
      throw invalid('codes');
    for (const [index, c] of input.codes.entries()) {
      const done = await db
        .update(languages)
        .set({ sortOrder: index })
        .where(eq(languages.code, c))
        .returning({ code: languages.code });
      if (done.length === 0) throw new AdminNotFoundError('мова');
    }
    await bumpCacheGeneration(db, CACHE_KEYS.languages);
    const rows = await db
      .select()
      .from(languages)
      .orderBy(asc(languages.sortOrder), asc(languages.code));
    return rows.map(toView);
  },
});

export const languagesRemove = defineOperation({
  id: 'languages.remove',
  permission: 'settings.manage',
  input: z.object({ code }),
  output: z.object({ code: z.string() }),
  async run({ db }, input) {
    await load(db, input.code);
    try {
      await db.delete(languages).where(eq(languages.code, input.code));
    } catch (error) {
      // 🔴 Мапінг ЛОКАЛЬНИЙ (К1): у цьому DELETE іншої FK-відмови бути не може,
      // тож будь-який 23503 = «мову використовують». За `error.table` не
      // мапимо: Postgres кладе туди таблицю, що ПОСИЛАЄТЬСЯ, а не `languages`.
      if (isForeignKeyViolation(error)) throw new InUseError('language_in_use');
      throw error;
    }
    await bumpCacheGeneration(db, CACHE_KEYS.languages);
    return { code: input.code };
  },
});
