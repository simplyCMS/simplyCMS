import { and, asc, eq, inArray, type Table } from 'drizzle-orm';
import {
  ADMIN_STATE_CONSTRAINT,
  stateConflict,
} from 'simplycms/contracts/domain-errors';
import type { ActorDb } from 'simplycms/db';
import {
  normalizeMediaRefs,
  type MediaEntityType,
} from 'simplycms/domain/media';
import { media as mediaTable } from 'simplycms/schema';
import { eraseMediaRows } from 'simplycms/storage';
import type { ResourceWriteContext } from './resource-write';

/**
 * Опція `media` фабрики ресурсів (Е6д-1) у рантайм-формі: колонки-референси
 * на файли сутності `entityType`. Тип конфігу (`resource-config.ts`) звужує
 * колонки до writable; тут вони вже просто імена.
 */
export type ResourceMedia = {
  readonly entityType: MediaEntityType;
  readonly columns: readonly string[];
};

// `never` — як у `resource-write.ts`: колонка генеричної таблиці під білдером.
const idColumn = (table: Table) =>
  (table as unknown as Record<string, never>)['id'];

/**
 * Знімок старих рядків update/remove — ОДИН запит на пакет (Е6д-1: двох
 * читань бути не повинно). `FOR UPDATE` тримає рядки до кінця транзакції:
 * guard зливає знімок із патчем (Е6д-2) без advisory-лока, а стирання бере
 * ключі зі знімка, який ніхто паралельно не змінить. `ORDER BY id` — один
 * порядок локів для паралельних пакетів (без взаємного блокування).
 */
export async function readSnapshot(
  db: ActorDb,
  ctx: ResourceWriteContext,
  ids: readonly string[],
): Promise<Map<string, Record<string, unknown>>> {
  if (ids.length === 0) return new Map();
  const id = idColumn(ctx.table);
  // UPSTREAM:DRZ-2 — docs/architecture/upstream-workarounds.md: проєкція `picked`.
  const rows = (await db
    .select(ctx.picked as never)
    .from(ctx.table)
    .where(inArray(id, [...ids]))
    .orderBy(asc(id))
    .for('update')) as Record<string, unknown>[];
  return new Map(rows.map((row) => [String(row.id), row]));
}

/**
 * Референси одного значення медіа-колонки (К3-Е6д-1): `text` — один непорожній
 * рядок, `jsonb` — масив (нормалізований: лише непорожні рядки).
 */
export const columnRefs = (value: unknown): string[] =>
  typeof value === 'string'
    ? value === ''
      ? []
      : [value]
    : normalizeMediaRefs(value);

/** Непорожні референси рядка по всіх колонках `media`. */
const refsOf = (media: ResourceMedia, row: Record<string, unknown> | null) =>
  new Set(media.columns.flatMap((col) => columnRefs(row?.[col])));

/**
 * Перевірка НОВИХ референсів (Е6д-1): непорожній ключ, якого не було в знімку
 * колонки (для jsonb-масиву — доданий елемент), мусить бути рядком `media` з `entity_type = media.entityType`
 * і `entity_id = <id рядка>`, інакше 409 `media_ref_invalid`.
 *
 * 🔴 Умова `entity_id` — не формальність: стирання йде за `storage_key`, тож
 * без неї підсунутий ключ іншого запису після наступної заміни стер би чужий
 * файл. Незмінений референс (демо `data:`/`https:`) не перевіряється — інакше
 * демо-банер не можна було б перейменувати. `FOR SHARE` — щоб паралельне
 * стирання не прибрало рядок між перевіркою і COMMIT.
 */
export async function assertMediaRefs(
  db: ActorDb,
  media: ResourceMedia,
  rows: readonly {
    id: string;
    next: Record<string, unknown>;
    before?: Record<string, unknown>;
  }[],
): Promise<void> {
  const wanted = rows.flatMap(({ id, next, before }) =>
    media.columns.flatMap((col) => {
      // Нові = ключі значення, яких не було в знімку ТІЄЇ Ж колонки: для
      // `text` — зміна рядка, для `jsonb`-масиву — додані елементи.
      const old = new Set(columnRefs(before?.[col]));
      return columnRefs(next[col])
        .filter((key) => !old.has(key))
        .map((key) => ({ id, key }));
    }),
  );
  if (wanted.length === 0) return;
  const found = await db
    .select({ key: mediaTable.storageKey, owner: mediaTable.entityId })
    .from(mediaTable)
    .where(
      and(
        inArray(mediaTable.storageKey, [...new Set(wanted.map((w) => w.key))]),
        eq(mediaTable.entityType, media.entityType),
      ),
    )
    .orderBy(asc(mediaTable.storageKey))
    .for('share');
  // `storage_key` унікальний, тож у ключа щонайбільше один власник.
  const ownerOf = new Map(found.map((r) => [r.key, r.owner]));
  for (const { id, key } of wanted) {
    if (ownerOf.get(key) !== id)
      stateConflict(ADMIN_STATE_CONSTRAINT.mediaRefInvalid);
  }
}

/**
 * Стирання рядків `media` заміненого чи видаленого (Е6д-1, Е6д-14): для
 * кожного рядка — МНОЖИНА `refs(before) \ refs(after)` по ВСІХ колонках
 * (одна картинка може стояти у двох колонках, і заміна однієї не стирає файл,
 * на який досі вказує інша). `after: null` — remove.
 *
 * Окремий виклик `eraseMediaRows` на рядок з його власником (Е6д-16): ключ,
 * що належить іншому запису (вписаний повз перевірку), сховище тихо
 * пропускає. Повертає ключі для `completeMediaErasures` ПІСЛЯ COMMIT — файли тут не
 * стираються.
 */
export async function eraseReplacedMedia(
  db: ActorDb,
  media: ResourceMedia,
  pairs: readonly {
    id: string;
    before: Record<string, unknown>;
    after: Record<string, unknown> | null;
  }[],
): Promise<string[]> {
  const discard: string[] = [];
  for (const { id, before, after } of pairs) {
    const kept = refsOf(media, after);
    const gone = [...refsOf(media, before)].filter((ref) => !kept.has(ref));
    if (gone.length === 0) continue;
    const owner = { entityType: media.entityType, entityId: id };
    discard.push(...(await eraseMediaRows(db, gone, owner)));
  }
  return discard;
}
