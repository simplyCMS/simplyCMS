// К3-Е6д, фінальне рев'ю (М1б, Е6д-19): гейт класу «каскад БД знищує рядок
// із медіа, а рядки `media` і файли лишаються». Для кожної таблиці реєстру
// `MEDIA_COLUMNS` шукаємо в КАТАЛОЗІ всіх предків, видалення яких доходить до
// неї ланцюжком FK `ON DELETE CASCADE`. Кожна пара «предок → медіа-колонка»
// мусить бути покрита опцією `cascadeMedia` ресурсу предка або стояти у
// `EXEMPT` з причиною. Нова каскадна медіа-колонка без рішення — червоний.
import { describe, expect, it, vi } from 'vitest';
import * as impl from 'simplycms/admin-server/impl';
import { MEDIA_COLUMNS } from 'simplycms/domain/media';
import { rows, useShippingAdminDb } from './fixtures/admin-shipping';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));

const BACKLOG =
  'опція media ресурсу ще не підключена (беклог Е6д-1, Task 10): каталожні фото власника, не персональні дані; орфани прибере sweep К4';

/** `предок → таблиця.колонка` → чому каскад тут не стирає медіа фабрикою. */
const EXEMPT: Record<string, string> = {
  'products → product_modifications.images': BACKLOG,
  'section_properties → property_options.image_url': BACKLOG,
  'sections → property_options.image_url': BACKLOG,
  'users → profiles.avatar_url':
    'користувача видаляє лише іменована операція deleteCustomer: аватар стирається двофазно (Е6г-15, Е6д-14), доказ — admin-customer-delete-photos/-locks',
};

type Pair = { ancestor: string; child: string; column: string };
const key = (p: Pair) => `${p.ancestor} → ${p.child}.${p.column}`;

/** Покриття, яке ресурси оголосили опцією `cascadeMedia` (рантайм-опис фабрики). */
const declared = (): string[] =>
  Object.values(impl).flatMap((value) => {
    const cm = (value as { cascadeMedia?: unknown } | null)?.cascadeMedia;
    if (!Array.isArray(cm)) return [];
    return (cm as { parent: string; child: string; column: string }[]).map(
      (c) => key({ ancestor: c.parent, child: c.child, column: c.column }),
    );
  });

describe('гейт: каскадні видалення не лишають медіа (Е6д-19)', () => {
  const db = useShippingAdminDb('simplycms_e6d_media_cascade');

  /** Пари (предок, дочірня таблиця) за транзитивним замиканням CASCADE-FK. */
  const cascades = async () =>
    (await rows(
      db.url(),
      `with recursive fk as (
         select ch.relname as child, pa.relname as parent
           from pg_constraint c
           join pg_class ch on ch.oid = c.conrelid
           join pg_class pa on pa.oid = c.confrelid
          where c.contype = 'f' and c.confdeltype = 'c'
            and c.connamespace = 'public'::regnamespace
       ), chain(child, ancestor) as (
         select child, parent from fk
         union
         select chain.child, fk.parent from chain join fk on fk.child = chain.ancestor
       )
       select child, ancestor from chain where child <> ancestor`,
    )) as { child: string; ancestor: string }[];

  const required = async (): Promise<Pair[]> => {
    const chain = await cascades();
    return MEDIA_COLUMNS.flatMap(({ table, column }) =>
      chain
        .filter((c) => c.child === table)
        .map((c) => ({ ancestor: c.ancestor, child: table, column })),
    );
  };

  it('кожна каскадна медіа-колонка покрита cascadeMedia або винятком із причиною', async () => {
    const covered = new Set(declared());
    const missing = (await required())
      .map(key)
      .filter((k) => !covered.has(k) && !EXEMPT[k]);
    expect(missing).toEqual([]);
  });

  it('оголошене покриття — справжній прямий CASCADE-FK; винятки не застарілі й не дублюють покриття', async () => {
    const direct = new Set(
      (
        (await rows(
          db.url(),
          `select ch.relname as child, pa.relname as parent
             from pg_constraint c
             join pg_class ch on ch.oid = c.conrelid
             join pg_class pa on pa.oid = c.confrelid
            where c.contype = 'f' and c.confdeltype = 'c'
              and c.connamespace = 'public'::regnamespace`,
        )) as { child: string; parent: string }[]
      ).map((r) => `${r.parent} → ${r.child}`),
    );
    const decl = declared();
    expect(decl.length).toBeGreaterThan(0);
    for (const k of decl) expect(direct).toContain(k.split('.')[0]);
    const req = new Set((await required()).map(key));
    for (const k of Object.keys(EXEMPT)) {
      expect(req).toContain(k);
      expect(decl).not.toContain(k);
    }
  });
});
