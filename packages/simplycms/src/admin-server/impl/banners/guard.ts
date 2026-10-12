import { getTableColumns } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { banners } from 'simplycms/schema';
import { fieldIssue } from '../validation';
import type { ResourceGuardWrite } from '../resource-config';

type Rec = Record<string, unknown>;
const COLUMNS = getTableColumns(banners);
const KEYS = [
  'placement',
  'sectionId',
  'dateFrom',
  'dateTo',
  'scheduleTimeFrom',
  'scheduleTimeTo',
] as const;
type Key = (typeof KEYS)[number];

/**
 * Відсутнє на insert поле = DB-default зі СХЕМИ (не літерал: зміна default у
 * `schema.ts` не розійдеться з guard-ом), nullable без default = `null`.
 * Інакше `undefined !== null` дав би хибні 400 на мінімальному insert.
 */
const withDefaults = (row: Rec): Rec =>
  Object.fromEntries(
    KEYS.map((k) => [
      k,
      row[k] !== undefined
        ? row[k]
        : COLUMNS[k].hasDefault
          ? COLUMNS[k].default
          : null,
    ]),
  );

/** `HH:MM` з форми й `HH:MM:SS` з Postgres порівнюються в одному форматі. */
const toSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t);
const ms = (d: unknown) => new Date(d as Date).getTime();
const touches = (patch: Rec | null, keys: readonly Key[]) =>
  patch === null || keys.some((k) => patch[k] !== undefined);

/**
 * Правила на ЗЛИТОМУ рядку (Е6д-2). `patch === null` — insert: перевіряється
 * все. На update правило живе, лише коли патч торкається його полів (Е6д-12):
 * банер, розділ якого видалено (FK `SET NULL`), інакше не вимкнути навіть
 * перемикачем.
 */
function check(row: Rec, patch: Rec | null): void {
  if (touches(patch, ['placement', 'sectionId'])) {
    if ((row.placement === 'section') !== (row.sectionId !== null))
      fieldIssue(['sectionId'], 'invalid_value');
  }
  if (touches(patch, ['dateFrom', 'dateTo']) && row.dateFrom && row.dateTo)
    if (ms(row.dateFrom) > ms(row.dateTo)) fieldIssue(['dateTo'], 'too_small');
  if (touches(patch, ['scheduleTimeFrom', 'scheduleTimeTo'])) {
    const { scheduleTimeFrom: from, scheduleTimeTo: to } = row;
    if ((from === null) !== (to === null))
      fieldIssue(['scheduleTimeTo'], 'invalid_value');
    if (from !== null && to !== null)
      if (toSeconds(String(from)) >= toSeconds(String(to)))
        fieldIssue(['scheduleTimeTo'], 'too_small');
  }
}

/** Guard банерів (Е6д-2): перехресні правила полів на злитому рядку. */
export async function guardBanners(
  _db: ActorDb,
  write: ResourceGuardWrite<Rec, Rec>,
): Promise<void> {
  if (write.kind === 'insert') {
    for (const row of write.rows) check(withDefaults(row), null);
    return;
  }
  // Кілька патчів одного id в пакеті накладаються по черзі на знімок.
  const state = new Map<string, Rec>();
  for (const u of write.updates) {
    const base = state.get(u.id) ?? u.before;
    if (!base) continue; // неіснуючий id — відмову дасть сам запис
    const merged = { ...base, ...u.patch };
    state.set(u.id, merged);
    check(withDefaults(merged), u.patch);
  }
}
