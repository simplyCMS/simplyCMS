import { Suspense, act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, type Locale } from 'simplycms/i18n';
import { REQUISITE_ATTRIBUTE } from 'simplycms/contracts/views';
import { ThemeContext } from '../theme-context';
import { resolveDefaultThemeSettings } from '../theme-settings';
import type { ThemeContextType, ThemeModule } from '../types';
import { ConformanceBoundary } from './boundary';

export interface ThemeViewRenderResult {
  /** Помилка рендеру або `null` — view пережив стан. */
  error: unknown;
  /** Імена знайдених у DOM маркерів реквізитів (у порядку документа). */
  requisites: string[];
}

/** Render-контекст, який kit гарантує кожному view теми (спека §7, п.3). */
function contextValue(theme: ThemeModule): ThemeContextType {
  return {
    activeTheme: theme,
    themeName: theme.manifest.name,
    // Default-и зі схеми теми: view, що читає `useThemeSettings`, тестований
    // без БД — рівно те, чого вимагає спека §8, п.3.
    themeSettings: resolveDefaultThemeSettings(theme.settings),
    themeRecord: null,
    isLoading: false,
    error: null,
    refreshTheme: () => Promise.resolve(),
  };
}

/**
 * Рендер одного view теми в DOM і зняття маркерів реквізитів.
 *
 * 🔴 Потрібне DOM-середовище (у vitest — `// @vitest-environment jsdom`):
 * conformance доводить саме РОЗМІТКУ, тому рендер справжній, а не
 * серіалізація в рядок. Гард середовища стоїть на публічному вході
 * (`assertThemeViewsConformance`), щоб автор теми отримав зрозумілу причину
 * до першого рендеру. `act` тут не з тест-бібліотеки, а з `react` — kit
 * публікується разом із ядром, і тягнути `@testing-library` у залежності
 * магазину заради двох рядків було б неспівмірно.
 */
export async function renderThemeView(
  element: ReactElement,
  theme: ThemeModule,
  locale: Locale,
): Promise<ThemeViewRenderResult> {
  let error: unknown = null;
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container, {
    // Помилку фіксує межа нижче; дефолтний лог React лише зашумив би вивід
    // гейта, який і так покаже причину в тексті винятку.
    onCaughtError: () => {},
    onUncaughtError: (uncaught: unknown) => {
      error = uncaught;
    },
  });

  const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousActEnv = actEnv.IS_REACT_ACT_ENVIRONMENT;
  actEnv.IS_REACT_ACT_ENVIRONMENT = true;

  try {
    await act(async () => {
      root.render(
        <I18nProvider locale={locale}>
          <ThemeContext.Provider value={contextValue(theme)}>
            <ConformanceBoundary
              onError={(caught) => {
                error = caught;
              }}
            >
              {/* Тема може читати каталог через `useThemeT` — той suspend-иться
                  на промісі реєстру, тож межа Suspense обовʼязкова. */}
              <Suspense fallback={null}>{element}</Suspense>
            </ConformanceBoundary>
          </ThemeContext.Provider>
        </I18nProvider>,
      );
    });

    const requisites = Array.from(
      container.querySelectorAll(`[${REQUISITE_ATTRIBUTE}]`),
    )
      .map((node) => node.getAttribute(REQUISITE_ATTRIBUTE))
      .filter((name): name is string => name !== null);

    return { error, requisites };
  } finally {
    await act(async () => {
      root.unmount();
    });
    actEnv.IS_REACT_ACT_ENVIRONMENT = previousActEnv;
    container.remove();
  }
}
