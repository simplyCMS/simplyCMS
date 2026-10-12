// Фікстури харнесу ресурсу банерів (К3-Е6д, Task 3): БД + допоміжні виклики
// над РЕАЛЬНИМ `bannersOps` і сід розділів.
import { expect } from 'vitest';
import { bannersOps } from 'simplycms/admin-server/impl';
import { withActor } from 'simplycms/db';
import { writeMedia } from 'simplycms/storage';
import { rows, useSystemAdminDb } from './admin-system';

export const BTN = {
  text: 'До каталогу',
  url: '/catalog',
  target: '_self',
  variant: 'primary',
} as const;

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Файл і рядок `media` банера: новий референс мусить належати своєму банеру (Е6д-1). */
const uploadFor = async (entityId: string) =>
  (
    await withActor({ role: 'app_admin' }, (tx) =>
      writeMedia(tx, {
        bytes: PNG,
        mime: 'image/png',
        entityType: 'banner',
        entityId,
        uploadedBy: null,
      }),
    )
  ).ref;

export function useBannersDb(prefix: string) {
  const db = useSystemAdminDb(prefix);
  const q = (sql: string, p: unknown[] = []) => rows(db.url(), sql, p);
  const snapshot = () => q('select * from public.banners order by id');
  const seedSection = async () => {
    const id = crypto.randomUUID();
    await q(
      `insert into public.sections (id, slug, name) values ($1, $2, 'Розділ')`,
      [id, `s-${id}`],
    );
    return id;
  };
  const insert = async (extra: Record<string, unknown> = {}) => {
    const id = crypto.randomUUID();
    const imageUrl =
      'imageUrl' in extra ? (extra.imageUrl as string) : await uploadFor(id);
    await bannersOps.insert({
      data: [{ id, title: 'Банер', ...extra, imageUrl }],
    });
    return id;
  };
  const row = async (id: string) =>
    (await q('select * from public.banners where id = $1', [id]))[0]!;
  const update = (id: string, patch: Record<string, unknown>) =>
    bannersOps.update({ data: [{ id, patch }] });
  /**
   * Відмова валідації: перший issue закінчується на `path` (схема додає
   * префікс `[індекс, …]`/`['patch', …]`, guard кидає шлях як є), код збігається,
   * а БД не змінилась.
   */
  const expectIssue = async (
    run: () => Promise<unknown>,
    path: (string | number)[],
    code?: string,
  ) => {
    const before = await snapshot();
    const err = (await run().then(
      () => null,
      (e: unknown) => e,
    )) as {
      name?: string;
      issues?: { path: unknown[]; code: string }[];
    } | null;
    expect(err?.name).toBe('ValidationError');
    const issue = err!.issues![0]!;
    expect(issue.path.slice(-path.length)).toEqual(path);
    if (code) expect(issue.code).toBe(code);
    expect(await snapshot()).toEqual(before);
  };
  return { db, q, snapshot, seedSection, insert, row, update, expectIssue };
}
