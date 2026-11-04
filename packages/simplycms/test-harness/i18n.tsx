// Фікстура мови інтерфейсу для тестів компонентів. Контракт зовнішнього боку — `TestI18nProvider`,
// `ukT`, `enT` — стабільний: тест не знає, звідки фікстура бере каталоги (зараз статичні пакети
// ядра, далі — завантажені частини). Тести САМОГО механізму (`i18n/__tests__`, `packs.test.ts`,
// `content-vs-ui-locale`) фікстуру не беруть: вони ганяють справжній провайдер і міст.
import type { ReactNode } from 'react';
import {
  I18nProvider,
  createTranslator,
  type Translator,
} from 'simplycms/i18n';
import { ui } from './locale';

/** Основна мова магазину в тесті — кінцева ланка fallback каталогів ядра, теми й плагіна. */
const PRIMARY = ui('uk');

/** Транслятор `uk`: точні тексти українського каталогу для асертів. */
export const ukT: Translator = createTranslator(ui('uk'), PRIMARY);

/** Транслятор `en` з fallback на `uk` (як у магазині з основною мовою `uk`). */
export const enT: Translator = createTranslator(ui('en'), PRIMARY);

/** Провайдер мови інтерфейсу для тесту; за замовчуванням `uk`. */
export function TestI18nProvider({
  locale = 'uk',
  children,
}: {
  locale?: 'uk' | 'en';
  children: ReactNode;
}) {
  return (
    <I18nProvider locale={ui(locale)} fallback={PRIMARY}>
      {children}
    </I18nProvider>
  );
}
