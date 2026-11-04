// Фікстура мови інтерфейсу для тестів компонентів. Контракт зовнішнього боку — `TestI18nProvider`,
// `ukT`, `enT` — стабільний: тест не знає, звідки фікстура бере каталоги (зараз статичні пакети
// ядра, далі — завантажені частини). Тести САМОГО механізму (`i18n/__tests__`, `packs.test.ts`,
// `content-vs-ui-locale`) фікстуру не беруть: вони ганяють справжній провайдер і міст.
import type { ReactNode } from 'react';
import {
  I18nProvider,
  createTranslator,
  type PartCatalog,
  type Translator,
} from 'simplycms/i18n';
import { messages as ukBase } from '../src/i18n/catalogs/uk/base';
import { messages as ukAdmin } from '../src/i18n/catalogs/uk/admin/index';
import { messages as ukMail } from '../src/i18n/catalogs/uk/mail';
import { messages as enBase } from '../src/i18n/catalogs/en/base';
import { messages as enAdmin } from '../src/i18n/catalogs/en/admin/index';
import { messages as enMail } from '../src/i18n/catalogs/en/mail';
import { ui } from './locale';

/**
 * Усі частини каталогу статично: тест не чекає реєстр і не залежить від чанків. Лише для
 * тестів — у продакшн-граф `test-harness` не потрапляє, там частини ледачі (І43).
 */
const CATALOGS: Record<'uk' | 'en', readonly PartCatalog[]> = {
  uk: [ukBase, ukAdmin, ukMail],
  en: [enBase, enAdmin, enMail],
};

/** Основна мова магазину в тесті — кінцева ланка fallback каталогів теми й плагіна. */
const PRIMARY = ui('uk');

/** Транслятор `uk`: точні тексти українського каталогу для асертів. */
export const ukT: Translator = createTranslator(CATALOGS.uk);

/** Транслятор `en`: повний англійський каталог (fallback ядру не потрібен). */
export const enT: Translator = createTranslator(CATALOGS.en);

/** Провайдер мови інтерфейсу для тесту; за замовчуванням `uk`. */
export function TestI18nProvider({
  locale = 'uk',
  children,
}: {
  locale?: 'uk' | 'en';
  children: ReactNode;
}) {
  return (
    <I18nProvider
      locale={ui(locale)}
      fallback={PRIMARY}
      catalogs={CATALOGS[locale]}
    >
      {children}
    </I18nProvider>
  );
}
