// Транслітерація українською за КМУ №55 від 27.01.2010 («національна» система).
// Власна таблиця: пакет зовнішньої транслітерації тягнув би залежність у T1
// заради ~40 літер, а правила початку слова й «зг» в них часто неповні.

/** Літери, транслітерація яких не залежить від позиції. */
const BASE: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  // М'який знак пропускається.
  ь: '',
};

/** Є, Ї, Й, Ю, Я на початку слова. */
const WORD_START: Readonly<Record<string, string>> = {
  є: 'ye',
  ї: 'yi',
  й: 'y',
  ю: 'yu',
  я: 'ya',
};

/** Є, Ї, Й, Ю, Я в решті позицій. */
const WORD_INNER: Readonly<Record<string, string>> = {
  є: 'ie',
  ї: 'i',
  й: 'i',
  ю: 'iu',
  я: 'ia',
};

/** Апостроф у всіх поширених накресленнях: за таблицею він пропускається. */
const APOSTROPHES = new Set(["'", '’', 'ʼ', '‘', '`']);

/** Чи є символ літерою або цифрою (тобто частиною слова). */
const isWordChar = (ch: string): boolean => /[\p{L}\p{N}]/u.test(ch);

/**
 * Транслітерація тексту в нижній регістр латиницею. Символи поза таблицею
 * (латиниця, цифри, пунктуація) проходять без змін — їх обробляє `slugify`.
 *
 * Початок слова — початок рядка або символ, що не є літерою/цифрою й не
 * апостроф: після апострофа (`Мар'їне` → `marine`) позиція «всередині слова».
 */
export function transliterateUk(text: string): string {
  const chars = Array.from(text.normalize('NFC').toLowerCase());
  let out = '';
  chars.forEach((ch, index) => {
    const prev = index > 0 ? chars[index - 1]! : '';
    if (APOSTROPHES.has(ch)) return;
    if (ch in WORD_START) {
      const atStart =
        prev === '' || !(isWordChar(prev) || APOSTROPHES.has(prev));
      out += (atStart ? WORD_START : WORD_INNER)[ch];
    } else if (ch === 'г' && prev === 'з') {
      // «зг» → «zgh», щоб не читалось як «zh» (ж).
      out += 'gh';
    } else {
      out += BASE[ch] ?? ch;
    }
  });
  return out;
}
