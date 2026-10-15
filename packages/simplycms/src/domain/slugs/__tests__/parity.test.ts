import { describe, expect, it } from 'vitest';
import * as barrel from 'simplycms/domain/slugs';
import { allocateSlug as direct } from '../allocate';
import { slugify as directSlugify } from '../slugify';
import { transliterateUk } from '../translit-uk';

const UK = { slugify: transliterateUk };

// 20 фіксованих назв: українські (з правилами початку слова й «зг»),
// латинські з діакритикою та змішані.
const NAMES = [
  'Сонячна панель 450 W',
  'Інвертор гібридний',
  'Акумулятор LiFePO4',
  'Згорани',
  'Щастя',
  'Юрій',
  'Ярослав Ґуральник',
  'Їжак',
  'Контролер заряду MPPT',
  'Кабель 4 мм² червоний',
  'Łódź Straße',
  'Æsir Œuvre',
  'Crème Brûlée',
  'Tip-Paneli',
  'Mono   Perc',
  'Батарея 12В/100Аг',
  'Реле «Захист»',
  'Знам’янка',
  'Біла Церква',
  'Панель Mono 2000',
] as const;

describe('адресний і токенний генератори — одна функція (І22)', () => {
  it('allocateSlug з модуля і з реекспорту simplycms/domain/slugs — той самий об’єкт', () => {
    expect(barrel.allocateSlug).toBe(direct);
  });

  it('slugify з модуля і з реекспорту — той самий об’єкт', () => {
    expect(barrel.slugify).toBe(directSlugify);
  });

  it('на 20 фіксованих назвах обидва шляхи дають однаковий slug (і з колізіями)', () => {
    const taken = new Set<string>();
    const tokens = new Set<string>();
    for (const name of NAMES) {
      const base = directSlugify(name, UK);
      const baseViaBarrel = barrel.slugify(name, UK);
      expect(baseViaBarrel).toBe(base);
      expect(base).not.toBeNull();

      const address = direct(base!, (c) => taken.has(c));
      const token = barrel.allocateSlug(baseViaBarrel!, (c) => tokens.has(c));
      expect(token).toBe(address);
      expect(barrel.SLUG_FORMAT.test(address)).toBe(true);
      taken.add(address);
      tokens.add(token);
    }
    // 20 назв дали 20 різних slug-ів: колізія «Панель Mono 2000» / «Mono Perc»
    // не склеює адреси.
    expect(taken.size).toBe(NAMES.length);
  });

  it('дві однакові назви отримують суфікс -2 в обох реєстрах однаково', () => {
    const registry = new Set<string>();
    const first = direct(directSlugify('Панель', UK)!, (c) => registry.has(c));
    registry.add(first);
    const second = barrel.allocateSlug(barrel.slugify('Панель', UK)!, (c) =>
      registry.has(c),
    );
    expect([first, second]).toEqual(['panel', 'panel-2']);
  });
});
