import { describe, it, expect } from 'vitest';
import type { UiCatalogPart } from '../packages/simplycms/src/i18n/types';
import { messages as ukBase } from '../packages/simplycms/src/i18n/catalogs/uk/base';
import { messages as ukAdmin } from '../packages/simplycms/src/i18n/catalogs/uk/admin/index';
import { messages as ukMail } from '../packages/simplycms/src/i18n/catalogs/uk/mail';
import { messages as enBase } from '../packages/simplycms/src/i18n/catalogs/en/base';
import { messages as enAdmin } from '../packages/simplycms/src/i18n/catalogs/en/admin/index';
import { messages as enMail } from '../packages/simplycms/src/i18n/catalogs/en/mail';

type Part = Readonly<Record<string, string>>;

const PARTS: Record<UiCatalogPart, { uk: Part; en: Part }> = {
  base: { uk: ukBase, en: enBase },
  admin: { uk: ukAdmin, en: enAdmin },
  mail: { uk: ukMail, en: enMail },
};

/**
 * Повнота англійських частин каталогу.
 *
 * Типом це доводить `satisfies Record<…Key, string>` на кожній англійській частині
 * (пропущений ключ не компілюється), але лише для РЯДКІВ ЛІТЕРАЛІВ; порожні значення,
 * зайві ключі через spread і розбіжність плейсхолдерів типом не видно — їх стереже цей
 * тест, по кожній частині окремо (Task 7 переведе значення на форми множини).
 */
describe.each(Object.keys(PARTS) as UiCatalogPart[])(
  'частина %s: uk ↔ en',
  (part) => {
    const { uk, en } = PARTS[part];
    const ukKeys = Object.keys(uk).sort();
    const enKeys = Object.keys(en).sort();

    it('en покриває кожен ключ uk', () => {
      const missing = ukKeys.filter((k) => !(k in en));

      expect(missing, `неперекладені ключі (${missing.length})`).toEqual([]);
    });

    it('en не має ключів поза uk', () => {
      // uk — джерело правди ключів, тож зайвий ключ в en означає або одрук, або
      // перейменування, доведене лише до половини каталогів.
      const extra = enKeys.filter((k) => !(k in uk));

      expect(extra, `ключі en, яких немає в uk`).toEqual([]);
    });

    it('жодне повідомлення не порожнє', () => {
      const empty = [
        ...ukKeys.filter((k) => !uk[k]?.trim()),
        ...enKeys.filter((k) => !en[k]?.trim()),
      ];

      expect(empty).toEqual([]);
    });

    it('плейсхолдери uk і en збігаються', () => {
      // Розбіжність тут — це рантайм-баг у зібраному рядку: `{count}`, забутий
      // у перекладі, віддасть англійцеві речення без числа.
      const placeholders = (s: string) =>
        (s.match(/\{(\w+)\}/g) ?? []).sort().join(',');
      const mismatched = ukKeys
        .filter((k) => k in en)
        .filter((k) => placeholders(uk[k]!) !== placeholders(en[k]!));

      expect(mismatched).toEqual([]);
    });
  },
);
