import type { ActorDb } from 'simplycms/db';
import type { ResourceCascadeMedia } from './resource-cascade-media';
import {
  eraseCascadeMedia,
  snapshotCascadeMedia,
} from './resource-cascade-snapshot';
import type { ResourceMedia } from './resource-media';
import { removeWithMedia } from './resource-write-media';
import {
  removeResourceRows,
  type ResourceWriteContext,
} from './resource-write';

/** Хуки видалення ресурсу (М1): див. `lockOnRemove`/`deleteRows` у `resource-config.ts`. */
export interface RemoveHooks {
  lockOnRemove?: (db: ActorDb, ids: readonly string[]) => Promise<void>;
  deleteRows?: (
    db: ActorDb,
    ids: readonly string[],
  ) => Promise<{ count: number }>;
}

/**
 * Тіло `remove`/`removeIn` фабрики (Е6д-1, Е6д-19): знімок каскадних медіа
 * (лок батьків → дочірні рядки) → DELETE (з власними `media`, якщо є опція)
 * → стирання рядків `media` дочірніх записів, яких знищив каскад. Файли — у
 * `discard`, їх стирає викликач ПІСЛЯ COMMIT (Е6д-14). Без обох опцій —
 * рівно колишній шлях.
 */
export async function removeRowsWithMedia(
  db: ActorDb,
  d: {
    ctx: ResourceWriteContext;
    media?: ResourceMedia;
    cascadeMedia?: readonly ResourceCascadeMedia[];
  } & RemoveHooks,
  rows: readonly { id: string }[],
  discard: string[],
): Promise<{ count: number }> {
  const ids = rows.map((r) => r.id);
  await d.lockOnRemove?.(db, ids);
  const cascade = d.cascadeMedia ?? [];
  const children = await snapshotCascadeMedia(db, d.ctx.table, cascade, ids);
  const del = d.deleteRows ?? ((x, i) => removeResourceRows(x, d.ctx.table, i));
  const result = d.media
    ? await removeWithMedia(
        db,
        { ctx: d.ctx, media: d.media },
        ids,
        discard,
        del,
      )
    : await del(db, ids);
  discard.push(...(await eraseCascadeMedia(db, children)));
  return result;
}
