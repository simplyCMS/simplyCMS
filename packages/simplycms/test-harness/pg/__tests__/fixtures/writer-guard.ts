// Гард «єдиного записувача» графа товару (М1, Task 10; Task 17 fix-1 — шаблонні імена;
// Task 17б — шаблон у `insertInto(`…`)`).
// Чисті функції над текстом файлу: тест `product-graph-fixture.test.ts` ганяє їх по харнесу.
//
// 🔴 Шаблонне ім'я таблиці (`insert into public.${owner}_property_values`) літеральний
// регекс не бачить — так `catalog-filters-root` писав значення повз билдер. Тепер шаблон
// розкривається за скінченним переліком власників (`VALUE_OWNERS` — те саме джерело, що
// й у билдера `valueSql`), а шаблон, який розкрити не можна, — ПОРУШЕННЯ гарда (його
// дозволяє лише явний перелік з причиною в тесті), а не тихий пропуск. Те саме правило —
// для query-builder-форми `insertInto(`${owner}_property_values`)`: інакше шаблонний
// рядок у білдері був би другим, неохопленим шляхом запису повз билдер графа.
import { VALUE_OWNERS } from './product-graph-types';

/** Таблиці, у які пише лише билдер графа (`fixtures/product-graph*.ts`). */
export const GUARDED_TABLES: readonly string[] = [
  'products',
  'product_modifications',
  ...VALUE_OWNERS.map((owner) => `${owner}_property_values`),
];
const DRIZZLE_NAMES =
  'products|productModifications|productPropertyValues|modificationPropertyValues';

// Регістронезалежно, `\s+` (перенос рядка, подвійний пробіл), кваліфікований `schema.x`.
export const PRODUCT_TABLES = new RegExp(
  `insert\\s+into\\s+(public\\.)?(${GUARDED_TABLES.join('|')})\\b|insert\\(\\s*[\\w.]*(${DRIZZLE_NAMES})\\b|insertInto\\(\\s*['"\`](${GUARDED_TABLES.join('|')})['"\`]`,
  'i',
);

/** Суфікси, які шаблон `${власник}<суфікс>` дає для кожного з `VALUE_OWNERS`. */
const OWNER_SUFFIXES = ['_property_values', '_property_value_translations'];
const INTERPOLATION = /\$\{[^}]*\}/g;
const TEMPLATED_TARGET =
  /insert\s+into\s+(?:public\.)?((?:\w|\$\{[^}]*\})*\$\{[^}]*\}(?:\w|\$\{[^}]*\})*)/gi;
// Білдер: увесь вміст шаблонного літерала з інтерполяцією, а не лише `\w`-символи — інакше
// `${schema}.products` не збігся б зовсім і пройшов би повз гард мовчки.
const TEMPLATED_INSERT_INTO = /insertInto\(\s*`([^`]*\$\{[^`]*)`/gi;

export interface TemplatedTargets {
  /** Розкриті імена, що потрапили в `GUARDED_TABLES`. */
  readonly guarded: string[];
  /** Шаблони, які гард не може розкрити за власниками. */
  readonly unexpandable: string[];
}

/** Цілі `insert into` / `insertInto(`…`)` із шаблонним іменем таблиці: розкриття за `VALUE_OWNERS`. */
export function templatedTargets(text: string): TemplatedTargets {
  const guarded: string[] = [];
  const unexpandable: string[] = [];
  const names = [
    ...[...text.matchAll(TEMPLATED_TARGET)].map((m) => m[1]!),
    ...[...text.matchAll(TEMPLATED_INSERT_INTO)].map((m) =>
      m[1]!.replace(/^public\./, ''),
    ),
  ];
  for (const name of names) {
    const parts = name.split(INTERPOLATION);
    const suffix = parts[1] ?? '';
    const expandable =
      parts.length === 2 && parts[0] === '' && OWNER_SUFFIXES.includes(suffix);
    if (!expandable) {
      unexpandable.push(name);
      continue;
    }
    for (const owner of VALUE_OWNERS) {
      const table = `${owner}${suffix}`;
      if (GUARDED_TABLES.includes(table)) guarded.push(table);
    }
  }
  return { guarded, unexpandable };
}

/** Чи пише текст у таблицю графа товару: літерально або шаблоном, що розкривається в неї. */
export const writesProductTables = (text: string): boolean =>
  PRODUCT_TABLES.test(text) || templatedTargets(text).guarded.length > 0;
