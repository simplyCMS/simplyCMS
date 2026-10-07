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

  const bad = (v: unknown): Obj =>
    typeof v === 'object' && v !== null ? (v as Obj) : {};
  rawGroups.forEach((g, i) => {
    try {
      out.groups.push(parseGroup(g, `groups[${i}]`));
    } catch (e) {
      const id = rawStr(bad(g).id) ?? `groups[${i}]`;
      console.error(`[simplycms/commerce] групу знижок виключено (${id}):`, e);
      out.invalid.push({
        id,
        name: rawStr(bad(g).name) ?? '',
        groupName: null,
        kind: 'group',
      });
    }
  });
  const rawDiscounts = rows(root.discounts, 'discounts');
  rawDiscounts.forEach((d, i) => {
    try {
      out.discounts.push(parseDiscount(d, `discounts[${i}]`));
    } catch (e) {
      const id = rawStr(bad(d).id) ?? `discounts[${i}]`;
      console.error(`[simplycms/commerce] знижку виключено (${id}):`, e);
      out.invalid.push({
        id,
        name: rawStr(bad(d).name) ?? '',
        groupName: groupNames.get(rawStr(bad(d).group_id) ?? '') ?? null,
        kind: 'discount',
      });
    }
  });
  dropUnreachable(out, groupNames);
  return out;
}

/**
 * Піддерево невалідної групи (або група з неіснуючим батьком) недосяжне від
 * коренів: ліс його й так не збудує, але діагностика ціни має ПОБАЧИТИ, які
 * валідні рядки через це не діють, — тож переносимо їх в `invalid`.
 */
function dropUnreachable(
  out: DiscountRules,
  groupNames: Map<string, string>,
): void {
  const reachable = new Set<string>();
  const queue = out.groups.filter((g) => g.parent_group_id === null);
  while (queue.length > 0) {
    const g = queue.pop() as DiscountRules['groups'][number];
    if (reachable.has(g.id)) continue;
    reachable.add(g.id);
    queue.push(...out.groups.filter((c) => c.parent_group_id === g.id));
  }
  for (const g of out.groups) {
    if (reachable.has(g.id)) continue;
    console.error(`[simplycms/commerce] групу недосяжно (${g.id})`);
    out.invalid.push({
      id: g.id,
      name: g.name,
      groupName: null,
      kind: 'group',
    });
  }
  for (const d of out.discounts) {
    if (reachable.has(d.group_id)) continue;
    console.error(`[simplycms/commerce] знижка в недосяжній групі (${d.id})`);
    out.invalid.push({
      id: d.id,
      name: d.name,
      groupName: groupNames.get(d.group_id) ?? null,
      kind: 'discount',
    });
  }
  out.groups = out.groups.filter((g) => reachable.has(g.id));
  out.discounts = out.discounts.filter((d) => reachable.has(d.group_id));
}
