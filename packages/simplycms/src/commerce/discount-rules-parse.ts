import type { DiscountRules } from 'simplycms/domain/discounts';
import { parseDiscount, parseGroup } from './discount-row-parsers';
import type { Obj } from './json-fields';

/** Рядок для діагностики: назва ЛИШЕ з сирого JSON, без жодної валідації. */
const rawStr = (v: unknown): string | null =>
  typeof v === 'string' ? v : null;

/** Масив рядків верхнього рівня; не масив — порожньо + журнал, не виняток. */
function rows(v: unknown, path: string): unknown[] {
  if (Array.isArray(v)) return v;
  console.error(`[simplycms/commerce] правила знижок: ${path} не масив`, v);
  return [];
}

/**
 * ЄДИНА межа «БД → домен» правил знижок (Е6в-8): дати стають `Date`,
 * `numeric` — числом явним розбором.
 *
 * 🔴 Розбір ПОРЯДКОВИЙ і fail-closed НА РЯДКУ (Е6в-25), сам він не кидає:
 * один пошкоджений рядок (рік 10000, `'NaN'`, невідомий enum), що обійшов
 * перевірку запису, інакше валив би ціни всього магазину. Невалідна група
 * зникає з піддеревом (ліс будується від коренів, тож діти недосяжні й
 * їхні знижки не застосуються), невалідна знижка — сама. Виключені рядки
 * лежать в `invalid` для діагностики ціни; у вітринний ліс вони не йдуть.
 * Умова відомого типу з поганим config сюди не належить: це
 * `condition_invalid` рушія (Е6в-23).
 */
export function parseDiscountRules(json: unknown): DiscountRules {
  const out: DiscountRules = { groups: [], discounts: [], invalid: [] };
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    console.error(
      '[simplycms/commerce] правила знижок: корінь не обʼєкт',
      json,
    );
    return out;
  }
  const root = json as Obj;
  const groupNames = new Map<string, string>();
  const rawGroups = rows(root.groups, 'groups');
  for (const g of rawGroups) {
    const o = typeof g === 'object' && g !== null ? (g as Obj) : {};
    const id = rawStr(o.id);
    const name = rawStr(o.name);
    if (id !== null && name !== null) groupNames.set(id, name);
  }

  rawGroups.forEach((g, i) => {
    try {
      out.groups.push(parseGroup(g, `groups[${i}]`));
    } catch (e) {
      const o = typeof g === 'object' && g !== null ? (g as Obj) : {};
      console.error(
        `[simplycms/commerce] групу знижок виключено (id=${String(o.id)}):`,
        e,
      );
      out.invalid.push({
        id: rawStr(o.id) ?? '',
        name: rawStr(o.name) ?? '',
        groupName: null,
        kind: 'group',
      });
    }
  });
  rows(root.discounts, 'discounts').forEach((d, i) => {
    try {
      out.discounts.push(parseDiscount(d, `discounts[${i}]`));
    } catch (e) {
      const o = typeof d === 'object' && d !== null ? (d as Obj) : {};
      console.error(
        `[simplycms/commerce] знижку виключено (id=${String(o.id)}):`,
        e,
      );
      out.invalid.push({
        id: rawStr(o.id) ?? '',
        name: rawStr(o.name) ?? '',
        groupName: groupNames.get(rawStr(o.group_id) ?? '') ?? null,
        kind: 'discount',
      });
    }
  });
  return out;
}
