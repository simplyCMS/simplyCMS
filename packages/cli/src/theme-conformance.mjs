// simplycms theme:conformance <name> — КАНОНІЧНИЙ канал запуску conformance-
// гейта контракту тем v3 (амендмент до Р8, 2026-08-18). Рушій тестів у шаблон
// магазину не додається: гейт має бути доступним і магазину без vitest.
// Прогін — `assertThemeViewsConformance` із `simplycms/themes/conformance`
// на модулі теми, взятому з simplycms.config.ts магазину.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configThemeEntries } from './config-edit.mjs';
import { findScaffoldRoot } from './context.mjs';
import { installStoreDom } from './theme-conformance-dom.mjs';
import { createStoreRunner } from './theme-conformance-env.mjs';
import { begin, finish, say } from './ui.mjs';

/**
 * Розбір аргументів. Позиційний токен — КЛЮЧ теми в simplycms.config.ts
 * (через `--name` при установці він може не збігатися ні з текою, ні з
 * іменем пакета — резолвити треба саме запис конфігу).
 * @param {string[]} argv
 * @returns {{ name: string }}
 */
export function parseThemeConformanceArgs(argv) {
  /** @type {string | undefined} */
  let name;
  for (const arg of argv) {
    if (arg.startsWith('-'))
      throw new Error(`Невідомий прапорець theme:conformance: ${arg}`);
    else if (!name) name = arg;
    else throw new Error(`Зайвий аргумент: ${arg}`);
  }
  if (!name)
    throw new Error('Не задано тему: simplycms theme:conformance <name>');
  return { name };
}

/**
 * Специфікатор `import()` теми за ключем конфігу. Помилка називає наявні
 * ключі — найчастіша причина промаху це друкарська помилка в імені.
 * @param {string} source
 * @param {string} name
 */
export function themeSpec(source, name) {
  const entries = configThemeEntries(source);
  if (entries === null)
    throw new Error(
      'Якір «themes: {» не знайдено в simplycms.config.ts — theme:conformance ' +
        'не має де шукати тему',
    );
  const entry = entries.find((item) => item.key === name);
  if (entry) return entry.spec;
  const known = entries.map((item) => `«${item.key}»`).join(', ');
  throw new Error(
    `Теми «${name}» немає в simplycms.config.ts. ` +
      (known ? `Є: ${known}.` : 'Обʼєкт themes порожній.'),
  );
}

/**
 * Підсумок звіту за ФАКТИЧНО прогнаними kit-ом сторінками.
 *
 * 🔴 Не `Object.keys(theme.views)`: заявити view й бути перевіреним — різні
 * речі (кейс складається явним блоком у `conformance/cases.tsx`). Друк
 * заявленого показував би прогін, якого не було, тож джерело рядка — те, що
 * повернув `assertThemeViewsConformance`.
 * @param {string[]} views
 */
export function conformanceSummary(views) {
  return views.length > 0
    ? `Conformance пройдено: views ${views.join(', ')}`
    : 'Прогнаних views немає — перевіряти нічого (це валідно).';
}

/** @param {string[]} argv */
export async function run(argv) {
  const { name } = parseThemeConformanceArgs(argv);
  begin('simplycms theme:conformance');
  // Той самий корінь, що в `create theme`: корінь монорепо ядра теж підходить,
  // бо автор теми ганяє гейт саме там, де щойно її скаффолдив.
  const storeRoot = findScaffoldRoot();
  const configPath = join(storeRoot, 'simplycms.config.ts');
  if (!existsSync(configPath))
    throw new Error(
      `Не знайдено ${configPath} — theme:conformance нема що читати`,
    );
  const spec = themeSpec(readFileSync(configPath, 'utf8'), name);
  say.step(`Тема «${name}» → import('${spec}')`);

  // jsdom — ПЕРШИМ: у магазину без DOM-пакета інструкція установки має
  // з'явитися до будь-якої довгої роботи раннера.
  await installStoreDom(storeRoot);
  const environment = await createStoreRunner(storeRoot);
  try {
    const module = await environment.runner.import(spec);
    const theme = module.default;
    if (!theme) throw new Error(`${spec} не має default-експорту ThemeModule`);
    const { assertThemeViewsConformance } = await environment.runner.import(
      'simplycms/themes/conformance',
    );
    const ran = await assertThemeViewsConformance(theme);
    say.success(conformanceSummary(ran));
  } finally {
    await environment.close();
  }
  finish('Готово.');
}
