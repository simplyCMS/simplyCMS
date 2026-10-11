import { getTableColumns, getTableName, is, type Table } from 'drizzle-orm';
import { PgJsonb, PgText } from 'drizzle-orm/pg-core';
import type { ActorDb } from 'simplycms/db';
import { completeMediaErasures } from 'simplycms/storage';
import { lockCatalogTarget } from './catalog-lock';
import type { ResourceGuard } from './resource-config';
import {
  assertMediaRefs,
  eraseReplacedMedia,
  readSnapshot,
  type ResourceMedia,
} from './resource-media';
import {
  removeResourceRows,
  updateResourceRows,
  type ResourceWriteContext,
} from './resource-write';

type Rec = Record<string, unknown>;

/** Рантайм-рубіж конфігу: тип звужує колонки до writable, а `text` — лише тут. */
export function assertMediaColumns(table: Table, media: ResourceMedia) {
  const columns = getTableColumns(table);
  for (const col of media.columns)
    if (!is(columns[col], PgText) && !is(columns[col], PgJsonb))
      throw new Error(
        `[admin-server] ${getTableName(table)}.${col}: media-колонка мусить бути text або jsonb`,
      );
  return media;
}

/** Insert media-ресурсу (Е6д-1): нові референси — після guard, до запису. */
export const assertInsertRefs = (
  db: ActorDb,
  media: ResourceMedia,
  rows: readonly Rec[],
) =>
  assertMediaRefs(
    db,
    media,
    rows.map((next) => ({ id: String(next.id), next })),
  );

/** Друга фаза Е6д-14: файли — ПІСЛЯ COMMIT; `completeMediaErasures` не кидає. */
export async function discardAll(keys: readonly string[]): Promise<void> {
  await completeMediaErasures(keys);
}

/**
 * 🔴 Колектор `discard` обовʼязковий для db-варіантів media-ресурсу (і
 * `removeIn` ресурсу з `cascadeMedia`, Е6д-19): без
 * нього ключі стертих рядків `media` загубились би, а файли мовчки лишились
 * орфанами (сід, порт). Помилка програміста, не користувача.
 */
export function requireDiscard(
  entity: string,
  needed: boolean,
  discard: string[] | undefined,
  op: string,
): string[] {
  if (needed && !discard)
    throw new Error(
      `[admin-server] ${entity}: ${op} media-ресурсу вимагає колектор discard`,
    );
  return discard ?? [];
}

/** Залежності media-шляху запису — підмножина `WriteOpsDeps` фабрики. */
export interface MediaWriteDeps<Insert, Patch> {
  ctx: ResourceWriteContext;
  media: ResourceMedia;
  lock?: string;
  guard?: ResourceGuard<Insert, Patch>;
}

/**
 * Update media-ресурсу (Е6д-1, КАНОН порядку): lock → знімок → guard (з
 * `before`, Е6д-2) → перевірка нових референсів → запис → стирання рядків
 * `media` заміненого. Ключі стертих рядків — у `discard`: файли стирає
 * викликач ПІСЛЯ COMMIT (Е6д-14).
 */
export async function updateWithMedia<Insert, Patch>(
  db: ActorDb,
  d: MediaWriteDeps<Insert, Patch>,
  parsed: readonly { id: string; patch: Patch }[],
  discard: string[],
): Promise<Rec[]> {
  if (d.lock) await lockCatalogTarget(db, d.lock);
  const snap = await readSnapshot(db, d.ctx, [
    ...new Set(parsed.map((u) => u.id)),
  ]);
  const updates = parsed.map((u) => ({
    id: u.id,
    patch: u.patch as Rec,
    before: snap.get(u.id),
  }));
  if (d.guard)
    await d.guard(db, {
      kind: 'update',
      updates: parsed.map((u) => ({
        ...u,
        before: snap.get(u.id) as Insert | undefined,
      })),
    });
  await assertMediaRefs(
    db,
    d.media,
    updates.map((u) => ({ id: u.id, next: u.patch, before: u.before })),
  );
  const out = (await updateResourceRows(db, d.ctx, updates)) as Rec[];
  // Остаточний стан рядка — останній RETURNING цього id у пакеті.
  const after = new Map(out.map((row) => [String(row.id), row]));
  const pairs = [...after].map(([id, row]) => ({
    id,
    before: snap.get(id) ?? {},
    after: row,
  }));
  discard.push(...(await eraseReplacedMedia(db, d.media, pairs)));
  return out;
}

/**
 * Remove media-ресурсу (Е6д-1): знімок → DELETE → стирання рядків `media`
 * видаленого. Без guard — як і чинний `remove` фабрики; неіснуючий id просто
 * не потрапляє ні в знімок, ні в лічильник.
 */
export async function removeWithMedia(
  db: ActorDb,
  d: Pick<MediaWriteDeps<unknown, unknown>, 'ctx' | 'media'>,
  ids: readonly string[],
  discard: string[],
): Promise<{ count: number }> {
  const snap = await readSnapshot(db, d.ctx, ids);
  const result = await removeResourceRows(db, d.ctx.table, ids);
  const pairs = [...snap].map(([id, before]) => ({ id, before, after: null }));
  discard.push(...(await eraseReplacedMedia(db, d.media, pairs)));
  return result;
}
