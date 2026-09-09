import { describe, it, expect } from 'vitest';
import { messages as uk } from '../packages/simplycms/src/i18n/catalogs/uk/index';
import { messages as en } from '../packages/simplycms/src/i18n/catalogs/en/index';

/**
 * Повнота англійського каталогу.
 *
 * 🔴 Типом це не доводиться: `Catalog = Partial<Record<MessageKey, string>>`
 * навмисно дозволяє дірки, щоб частковий переклад падав у fallback на uk, а не
 * ламав збірку. Ціна контракту — «переклад є» і «переклад повний» стають
 * різними твердженнями, і друге може дати лише тест.
 */
describe('каталоги uk ↔ en', () => {
  const ukKeys = Object.keys(uk).sort();
  const enKeys = Object.keys(en).sort();

  it('en покриває кожен ключ uk', () => {
    const missing = ukKeys.filter((k) => !(k in en));

    expect(missing, `неперекладені ключі (${missing.length})`).toEqual([]);
  });

  it('en не має ключів поза uk', () => {
    // uk — джерело правди `MessageKey`, тож зайвий ключ в en означає або
    // одрук, або перейменування, доведене лише до половини каталогів.
    const extra = enKeys.filter((k) => !(k in uk));

    expect(extra, `ключі en, яких немає в uk`).toEqual([]);
  });

  it('жодне повідомлення не порожнє', () => {
    const empty = [
      ...ukKeys.filter((k) => !(uk as Record<string, string>)[k]?.trim()),
      ...enKeys.filter((k) => !(en as Record<string, string>)[k]?.trim()),
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
      .filter(
        (k) =>
          placeholders((uk as Record<string, string>)[k]) !==
          placeholders((en as Record<string, string>)[k]!),
      );

    expect(mismatched).toEqual([]);
  });
});
