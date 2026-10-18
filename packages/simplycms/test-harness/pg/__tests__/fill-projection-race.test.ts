// Фінальне рев'ю М1 (I-1, І23): `languages.fill` будує проєкцію лише з адрес, закомічених
// ПОПЕРЕДНІМ викликом. Інакше команда товару, паралельна fill, незакоміченої адреси не бачить,
// рядка мови не пише, і fill комітить текст зі знімка до команди — застарілий назавжди.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { findProjectionMismatches } from 'simplycms/catalog-projection';
import { advisoryXactLockShared } from 'simplycms/db';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';
import {
  languagesAdd,
  languagesFill,
  languagesSetStatus,
} from 'simplycms/admin-server/impl';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { fillBatch } from '../../../src/admin-server/impl/languages/fill';
import { useAddressingDb } from './fixtures/addressing-db';
import { hold, until, waitForSettled } from './fixtures/lock-holders';
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
  const mismatches = () => db.admin((d) => findProjectionMismatches(d, {}));

  it('fill тримає транзакцію з новою адресою, команда комітить свіжий текст → після обох комітів звірка 0', async () => {
    const { id, version } = await create({ uk: { name: 'Старе' } });
    await add('bg');
    // Fill як операція: спільний set, потім пакет; транзакція відкрита до `release`.
    const fill = hold(db, async (d) => {
      await advisoryXactLockShared(d, LOCK_KEYS.languagesSet);
      return fillBatch(d, 'bg', 1000);
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
});
