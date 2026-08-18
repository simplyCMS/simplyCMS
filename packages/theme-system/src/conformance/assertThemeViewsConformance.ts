import type { Locale } from '@simplycms/i18n';
import {
  REQUIRED_REQUISITES,
  type StorefrontViewName,
} from '@simplycms/objects/views';
import { ThemeRegistry } from '../ThemeRegistry';
import { validateThemeModule } from '../validateThemeModule';
import type { ThemeModule } from '../types';
import { buildConformanceCases, CONFORMANCE_STATES } from './cases';
import { renderThemeView } from './render';

export interface ThemeViewsConformanceOptions {
  /** Локаль рендеру; за замовчуванням `uk` — як і fallback core-каталогу. */
  locale?: Locale;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Реєструє тему в `ThemeRegistry` на час прогону, якщо її там ще немає:
 * `useThemeT` бере каталог саме звідти (`use(ThemeRegistry.load(name))`), і
 * без реєстрації view теми з перекладами впав би на етапі підготовки.
 * Повертає `true`, якщо реєстрацію зробив kit — тоді її ж і знімаємо.
 */
function ensureRegistered(theme: ThemeModule): boolean {
  const { name } = theme.manifest;
  if (ThemeRegistry.has(name)) return false;

  ThemeRegistry.register(name, () => Promise.resolve({ default: theme }));
  return true;
}

/**
 * Conformance-гейт контракту тем v3: рендерить КОЖЕН заявлений темою view на
 * фікстурних view-model-ах ядра й асертить два твердження —
 *
 * 1. на повному стані присутні всі обовʼязкові реквізити сторінки (маркери
 *    `data-simplycms-requisite`, склад — `REQUIRED_REQUISITES`);
 * 2. рендер не падає на крайніх станах (товар без фото, порожній кошик,
 *    порожня секція, магазин без категорій).
 *
 * 🔴 Склад реквізитів перевіряється ЛИШЕ на стані `full`, і це не послаблення.
 * На крайньому стані сторінка може структурно прибрати весь блок реквізитів
 * разом із даними (порожній кошик показує заглушку, магазин без кореневих
 * категорій не має жодної каруселі) — вимога «маркер присутній завжди»
 * червоніла б там не на дефекті теми. Тому `edge` доводить рівно те, що може
 * довести: рендер живий.
 *
 * 🔴 Рантайм-fallback на канонічний view при провалі НЕ робиться (рішення V3
 * спеки §7): дефект має бути видно на гейті, а не маскуватися в проді.
 *
 * Тема без `views` — чесний pass: перевіряти нема чого.
 *
 * 🔴 Повертає перелік ФАКТИЧНО прогнаних сторінок (порядок — `cases`), а не
 * заявлених темою. Різниця не косметична: заявлений ключ, для якого в
 * `buildConformanceCases` немає блоку, не перевіряється — і звіт, зібраний із
 * `Object.keys(theme.views)`, показав би прогін, якого не було. Тому і CLI
 * (`simplycms theme:conformance`), і тести друкують/асертять саме це
 * значення.
 *
 * Потрібне DOM-середовище (`// @vitest-environment jsdom`). Якщо view теми
 * використовує `Link` із `@tanstack/react-router`, тест магазину має або
 * підняти роутер, або замокати модуль — kit роутера не піднімає навмисно
 * (він перевіряє тему, а не навігацію).
 */
export async function assertThemeViewsConformance(
  theme: ThemeModule,
  options: ThemeViewsConformanceOptions = {},
): Promise<StorefrontViewName[]> {
  if (typeof document === 'undefined') {
    throw new Error(
      '[theme:conformance] Потрібне DOM-середовище: додайте до тесту ' +
        'директиву `// @vitest-environment jsdom`',
    );
  }

  validateThemeModule(theme);

  const cases = theme.views ? buildConformanceCases(theme.views) : [];
  if (cases.length === 0) return [];

  const locale = options.locale ?? 'uk';
  const themeName = theme.manifest.name;
  const registeredByKit = ensureRegistered(theme);

  try {
    for (const item of cases) {
      for (const state of CONFORMANCE_STATES) {
        const { error, requisites } = await renderThemeView(
          item.states[state],
          theme,
          locale,
        );

        if (error !== null) {
          throw new Error(
            `[theme:conformance] "${themeName}": views.${item.name} впав на ` +
              `стані "${state}": ${describe(error)}`,
            { cause: error },
          );
        }

        if (state !== 'full') continue;

        const missing = REQUIRED_REQUISITES[item.name].filter(
          (requisite) => !requisites.includes(requisite),
        );
        if (missing.length > 0) {
          throw new Error(
            `[theme:conformance] "${themeName}": views.${item.name} не ` +
              `розставив обовʼязкові реквізити: ${missing.join(', ')}`,
          );
        }
      }
    }
  } finally {
    if (registeredByKit) ThemeRegistry.unregister(themeName);
  }

  return cases.map((item) => item.name);
}
