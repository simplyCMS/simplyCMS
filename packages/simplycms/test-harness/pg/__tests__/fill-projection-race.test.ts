// Фінальне рев'ю М1 (I-1, N1; І23): `languages.fill` копіює адреси під спільним `languages-set`, а
// проєкцію будує лише під ЕКСКЛЮЗИВНИМ — після коміту всіх команд у польоті. Інакше команда товару,
// чий refresh пройшов до коміту адрес, а коміт — після побудови, лишала б рядок застарілим назавжди.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { findProjectionMismatches } from 'simplycms/catalog-projection';
import { advisoryXactLock, advisoryXactLockShared } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  languagesAdd,
  languagesFill,
  languagesSetStatus,
  productsSaveDescription,
} from 'simplycms/admin-server/impl';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { fillBatch } from '../../../src/admin-server/impl/languages/fill';
import { ADMIN, useAddressingDb } from './fixtures/addressing-db';
import {
  hold,
  until,
  waitForBlockedTree,
  waitForSettled,
} from './fixtures/lock-holders';
import { outcome } from './fixtures/latch-race';
import { create, exec, saveDescription } from './fixtures/product-aggregate';

describe('fill ↔ команда товару без попереднього коміту адрес (I-1, І23)', () => {
  const db = useAddressingDb('simplycms_fill_projection_race');
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code });
  const fillAll = async (code: string) => {
    for (let i = 0; i < 50; i += 1)
      if ((await exec(languagesFill, { code })).done) return;
    throw new Error('fill не завершився');
  };
  const projName = async (id: string, locale: string) =>
    (
      await db.q(
        `select name from public.catalog_product_texts where product_id = $1 and locale = $2`,
        [id, locale],
      )
    )[0]?.name;
  /** Розбіжності проєкції (мовою `locale` — щоб незавершені мови сусідніх кейсів не заважали). */
  const mismatches = (locale?: string) =>
    db.admin((d) => findProjectionMismatches(d, locale ? { locale } : {}));

  it('fill тримає транзакцію з новою адресою, команда комітить свіжий текст → після обох комітів звірка 0', async () => {
    const { id, version } = await create({ uk: { name: 'Старе' } });
    await add('bg');
    // Fill як операція в режимі адрес: спільний set, потім пакет; транзакція відкрита до `release`.
    const fill = hold(db, async (d) => {
      await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
      return fillBatch(d, 'bg', 1000, 'addresses');
    });
    await until('fill скопіював адресу й тримає транзакцію', fill.acquired);
    const command = saveDescription(id, version, {
      texts: { uk: { name: 'Нове' } },
    });
    // Строго: команда з fill не конфліктує (NO KEY UPDATE проти KEY SHARE, рядка проєкції
    // мови вона не бачить) і мусить закомітитись, поки fill ще відкритий — саме це вікно гонки.
    await waitForSettled(
      'команда закомітилась повз відкритий fill',
      command,
      fill,
    );
    await command;
    fill.release();
    await fill.done;
    await fillAll('bg');
    expect(await projName(id, 'bg')).toBe('Нове');
    expect(await mismatches()).toEqual([]);
  });

  it('один виклик fill не повертає done з незбудованою проєкцією; наступний її будує', async () => {
    const { id } = await create({ uk: { name: 'Етапи' } });
    await add('ro');
    const first = await exec(languagesFill, { code: 'ro' });
    // Адреса скопійована цим викликом, проєкція — ще ні: `done` мусить бути false.
    expect(first.done).toBe(false);
    expect(await projName(id, 'ro')).toBeUndefined();
    const second = await exec(languagesFill, { code: 'ro' });
    expect(second.done).toBe(true);
    expect(await projName(id, 'ro')).toBe('Етапи');
  });

  it('language_incomplete називає товар і етап, якого бракує', async () => {
    const { id } = await create({ uk: { name: 'Неповний' } });
    await add('hr');
    const refuse = () =>
      exec(languagesSetStatus, { code: 'hr', status: 'published' }).catch(
        (e: unknown) => e,
      );
    const noPath = await refuse();
    expect(noPath).toBeInstanceOf(ValidationError);
    expect((noPath as ValidationError).issues).toContainEqual({
      path: ['products', id, 'path'],
      code: 'language_incomplete',
    });
    // Адреса є, проєкції ще немає (лише перший пакет fill) — етап `projection`.
    await exec(languagesFill, { code: 'hr' });
    const noProjection = (await refuse()) as ValidationError;
    expect(noProjection.issues[0]).toEqual({
      path: ['status'],
      code: 'language_incomplete',
    });
    expect(noProjection.issues).toContainEqual({
      path: ['products', id, 'projection'],
      code: 'language_incomplete',
    });
    expect(noProjection.issues).not.toContainEqual({
      path: ['products', id, 'path'],
      code: 'language_incomplete',
    });
  });

  it('N1: команда тримає транзакцію ПІСЛЯ refresh → fill №1 (адреси) → fill №2 (проєкція) чекає її коміту → звірка 0', async () => {
    const { id, version } = await create({ uk: { name: 'Старе' } });
    await add('mt');
    // Справжня команда (run операції) у відкритій транзакції: refresh пройшов ДО коміту адрес
    // fill, тож рядка мови вона не пише; коміт — пізніше («хвіст» команди).
    const command = hold(db, (d) =>
      productsSaveDescription.run(
        {
          db: d,
          subject: { userId: ADMIN.userId, roles: ['admin'] },
          actor: { userId: ADMIN.userId, role: 'app_admin' },
          afterCommit: () => undefined,
        } as never,
        { id, expectedVersion: version, texts: { uk: { name: 'Нове' } } },
      ),
    );
    await until(
      'команда зробила refresh і тримає транзакцію',
      command.acquired,
    );
    // №1 — режим адрес (спільний set): проходить повз команду.
    const first = exec(languagesFill, { code: 'mt' });
    await waitForSettled('fill №1 завершився повз команду', first, command);
    expect((await first).done).toBe(false);
    // №2 — проєкція під ЕКСКЛЮЗИВНИМ set: строго стає в чергу за спільним set команди.
    const second = exec(languagesFill, { code: 'mt' });
    await waitForBlockedTree(db, command, 1, { releaseOnFail: true });
    command.release();
    await command.done;
    expect((await second).done).toBe(true);
    expect(await projName(id, 'mt')).toBe('Нове');
    expect(await mismatches('mt')).toEqual([]);
  });

  it('N1: два fill проєкції паралельно — ok/ok, без 40P01 (ексклюзивний set ПЕРШИМ, без спільного перед ним)', async () => {
    await create({ uk: { name: 'Два fill' } });
    await add('ky');
    await exec(languagesFill, { code: 'ky' }); // адреси — далі обидва виклики будують проєкцію
    // T0 тримає ЕКСКЛЮЗИВНИЙ set: обидва fill стають у чергу ДО того, як будь-який почне. Після
    // відпускання Postgres видає сумісні запити разом: якби виклик брав спільний set перед
    // ексклюзивним, обидва отримали б спільний і взаємно заблокували підвищення (40P01).
    const t0 = hold(db, (d) => advisoryXactLock(d, LOCK_KEYS.languagesSet));
    await until('T0 тримає ексклюзивний set', t0.acquired);
    const a = outcome(exec(languagesFill, { code: 'ky' }));
    const b = outcome(exec(languagesFill, { code: 'ky' }));
    await waitForBlockedTree(db, t0, 2, { releaseOnFail: true });
    t0.release();
    await t0.done;
    expect([await a, await b]).toEqual(['ok', 'ok']);
    expect(await mismatches('ky')).toEqual([]);
  });
});
