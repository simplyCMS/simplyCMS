import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_SERVER_FIRST } from '../admin-server-first';
import { ENTITY } from '../entities';

/** Одна нормалізація для ОБОХ сторін (R13-дрібниця: асиметрія пропускала bare-camelCase імʼя файла). */
const toSnake = (s: string) =>
  s
    .replace(/\.tsx?$/, '')
    .replace(/-/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();

describe('реєстр server-first винятків (К3-2)', () => {
  const collections = readdirSync(
    join(import.meta.dirname, '../../admin-data/collections'),
  ).map(toSnake);

  it.each(Object.keys(ADMIN_SERVER_FIRST))(
    '%s — у реєстрі винятків, колекція заборонена',
    (name) => {
      expect(collections).not.toContain(toSnake(name));
    },
  );

  it('реєстр непорожній', () => {
    expect(Object.keys(ADMIN_SERVER_FIRST).length).toBeGreaterThan(0);
  });

  /**
   * 🔴 НЕ узагальнено на весь реєстр через `it.each` (рев'ю R13 пропонував
   * узагальнити, але на живому реєстрі це фактичний АСЕРТ ХИБНОГО:
   * `systemSettings` ОДНОЧАСНО (а) реальна таблиця схеми — `entityKey.ts`
   * будує `ENTITY` з Drizzle-схеми, а `schema/__tests__/entity-parity.test.ts`
   * ПОСТІЙНИМ гейтом вимагає, щоб КОЖНА таблиця схеми мала запис в ENTITY,
   * тож прибрати `system_settings` звідти неможливо — і (б) законний запис
   * у `ADMIN_SERVER_FIRST`: «немає TanStack DB-колекції» ≠ «немає сутності
   * в БД». Ці два реєстри відповідають на РІЗНІ питання, і збіг для
   * `systemSettings` — коректний дизайн, не дефект.
   *
   * `priceValidator` — інший випадок: за власним описом реєстру це
   * «обчислення, не сутність», тобто таблиці схеми в принципі не існує
   * (підтверджено — `priceValidator`/`price_validator` немає в ENTITY).
   * Саме для НЬОГО (і лише нього) відсутність в ENTITY — реальний,
   * перевірний інваріант; для `systemSettings` той самий чек звалився б
   * фальшивим офендером, а не знахідкою.
   */
  it('priceValidator — чисте обчислення, не таблиця схеми (не плутати з systemSettings)', () => {
    expect(Object.values(ENTITY)).not.toContain(toSnake('priceValidator'));
  });
});
