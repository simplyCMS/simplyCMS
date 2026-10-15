import { describe, expect, it } from 'vitest';
import { SLUG_FORMAT, slugify } from '../index';
import { transliterateUk } from '../translit-uk';

const UK = { slugify: transliterateUk };

describe('slugify з українською таблицею (КМУ №55 від 27.01.2010)', () => {
  it.each([
    ['Згорани', 'zghorany'],
    ['Щастя', 'shchastia'],
    ['Юрій', 'yurii'],
    ['Ярослав Ґуральник', 'yaroslav-guralnyk'],
    ['Їжак', 'yizhak'],
  ])('%s → %s', (text, expected) => {
    expect(slugify(text, UK)).toBe(expected);
  });

  // Приклади з офіційної таблиці постанови: початок слова, «зг», апостроф, «ь».
  it.each([
    ['Алушта', 'alushta'],
    ['Борщагівка', 'borshchahivka'],
    ['Вінниця', 'vinnytsia'],
    ['Гадяч', 'hadiach'],
    ['Ґалаґан', 'galagan'],
    ['Єнакієве', 'yenakiieve'],
    ['Кадиївка', 'kadyivka'],
    ["Мар'їне", 'marine'],
    ['Йосипівка', 'yosypivka'],
    ['Стрий', 'stryi'],
    ['Тернопіль', 'ternopil'],
    ['Ужгород', 'uzhhorod'],
    ['Згурський', 'zghurskyi'],
    ['Христинівка', 'khrystynivka'],
    ['Біла Церква', 'bila-tserkva'],
    ['Чернівці', 'chernivtsi'],
    ['Феодосія', 'feodosiia'],
    ['Знам’янка', 'znamianka'],
    ['Олександрія', 'oleksandriia'],
  ])('офіційний приклад %s → %s', (text, expected) => {
    expect(slugify(text, UK)).toBe(expected);
  });

  it('Ґ і Г різні: Ґ → g, Г → h', () => {
    expect(slugify('Ґанок Гора', UK)).toBe('ganok-hora');
  });

  it('початок слова після дефіса й пробілу — теж початок', () => {
    expect(slugify('Юрій-Яків', UK)).toBe('yurii-yakiv');
  });

  it('цифри й латиниця в українському тексті лишаються', () => {
    expect(slugify('Панель 450 W Mono', UK)).toBe('panel-450-w-mono');
  });
});

describe('slugify без таблиці (латиниця)', () => {
  it("Łódź Straße → 'lodz-strasse'", () => {
    expect(slugify('Łódź Straße', null)).toBe('lodz-strasse');
  });

  it("Æsir Œuvre → 'aesir-oeuvre'", () => {
    expect(slugify('Æsir Œuvre', null)).toBe('aesir-oeuvre');
  });

  it('діакритика знімається: Crème Brûlée → creme-brulee', () => {
    expect(slugify('Crème Brûlée', null)).toBe('creme-brulee');
  });

  it('đ, þ, ø з малої мапи', () => {
    expect(slugify('Đorđe Þór Øresund', null)).toBe('dorde-thor-oresund');
  });

  it('пунктуація й повтори дефісів зводяться до одного', () => {
    expect(slugify('  Hello,   World!!!  ', null)).toBe('hello-world');
    expect(slugify('--a---b--', null)).toBe('a-b');
    expect(slugify('a_b/c.d', null)).toBe('a-b-c-d');
  });

  it('апострофи зникають, а не розбивають слово', () => {
    expect(slugify("Don't Stop", null)).toBe('dont-stop');
  });

  it('не-ASCII пунктуація (довге тире, лапки) — роздільник, а не відмова', () => {
    expect(slugify('Hello — «World»', null)).toBe('hello-world');
  });

  // Символи сумісності розкладаються NFKD у ВЕЛИКІ літери: нижній регістр
  // мусить іти після розкладання, інакше вони стають роздільниками.
  it.each([
    ['Кабель №2', UK, 'kabel-no2'],
    ['10 ℃', null, '10-c'],
    ['Brand™ X', null, 'brandtm-x'],
    ['Fi ﬁ ligature', null, 'fi-fi-ligature'],
  ])('символи сумісності: %s → %s', (text, pack, expected) => {
    expect(slugify(text, pack)).toBe(expected);
  });

  it('результат завжди проходить SLUG_FORMAT', () => {
    for (const text of ['Łódź Straße', 'a  b', 'x1-y2']) {
      expect(SLUG_FORMAT.test(slugify(text, null) ?? '')).toBe(true);
    }
  });
});

describe('slugify: відмова замість мотлоху', () => {
  it('нелатинське письмо без таблиці → null', () => {
    expect(slugify('東京', null)).toBeNull();
  });

  it('кирилиця без таблиці → null', () => {
    expect(slugify('Згорани', null)).toBeNull();
  });

  it('змішане письмо: решта не-ASCII літер після таблиці → null', () => {
    expect(slugify('Hello 東京', null)).toBeNull();
  });

  it('текст без жодного слова → null', () => {
    expect(slugify('!!! ---', null)).toBeNull();
    expect(slugify('', null)).toBeNull();
  });
});

describe('SLUG_FORMAT', () => {
  it.each(['mono', 'tip-paneli', 'a1-b2'])('приймає %s', (s) =>
    expect(SLUG_FORMAT.test(s)).toBe(true),
  );
  it.each(['', 'Mono', 'a--b', '-a', 'a b', 'a_b'])('відкидає %j', (s) =>
    expect(SLUG_FORMAT.test(s)).toBe(false),
  );
});
