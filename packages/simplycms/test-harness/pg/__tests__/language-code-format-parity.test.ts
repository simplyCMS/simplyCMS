// М1 (Task 16 → Task 17): форма коду мови має ДВА носії — `LANGUAGE_CODE_FORMAT` (межа
// вводу в TS) і CHECK `languages_code_format` у схемі. Тест ганяє один набір векторів
// BCP 47 проти обох: TS-регексом і справжньою вставкою в `languages` (CHECK, а не копія
// його виразу). Розбіжність дала б або 500 на валідному для форми коді, або 400 на коді,
// який БД прийняла б.
import { describe, expect, it } from 'vitest';
import { isCheckViolation } from 'simplycms/db';
import { LANGUAGE_CODE_FORMAT } from 'simplycms/domain/translations';
import { useAddressingDb } from './fixtures/addressing-db';

const VALID = [
  'de',
  'fil',
  'en-GB',
  'pt-BR',
  'zh-Hant',
  'zh-Hant-TW',
  'sr-Latn-RS',
];
const INVALID = [
  'EN',
  'e',
  'english',
  'en_GB',
  'en-gb',
  'en-GBR',
  'zh-hant',
  'zh-HANT',
  'en-',
  '-en',
  'uk-UA-x',
  'en-GB-Latn',
  '',
];

describe('парність форми коду мови: LANGUAGE_CODE_FORMAT ↔ CHECK languages_code_format', () => {
  const db = useAddressingDb('simplycms_language_code_parity');

  /** Чи приймає код CHECK схеми: вставка під замком мов, 23514 — відмова форми. */
  const dbAccepts = async (code: string): Promise<boolean> => {
    try {
      await db.w(
        `insert into public.languages (id, code, name, status, is_default, sort_order)
         values (gen_random_uuid(), $1::text, $1::text, 'draft', false, 9)`,
        [code],
      );
      await db.w(`delete from public.languages where code = $1`, [code]);
      return true;
    } catch (error) {
      // Відмова форми — лише САМЕ цей CHECK: інший CHECK чи тригер `languages` з тим
      // самим SQLSTATE (23514) не мусить зійти за «БД відхиляє код».
      if (isCheckViolation(error, 'languages_code_format')) return false;
      throw error;
    }
  };

  it.each([...VALID.map((c) => [c, true]), ...INVALID.map((c) => [c, false])])(
    '%j: обидва носії дають %s',
    async (code, valid) => {
      expect(LANGUAGE_CODE_FORMAT.test(code as string)).toBe(valid);
      expect(await dbAccepts(code as string)).toBe(valid);
    },
  );
});
