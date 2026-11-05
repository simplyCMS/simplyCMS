/**
 * Локалізований текст для селекторів у специфікаціях.
 *
 * 🔴 Кнопки/лейбли залежать від локалі (`t('auth.login.submit')` тощо), тож
 * специ читають ТОЙ САМИЙ каталог, що й застосунок, а не вгадують рядок під конкретну
 * мову. Частини каталогу тут статичні (раннер синхронний, реєстр ледачий — асинхронний),
 * повнота каталогу — типом (`satisfies`), тож fallback-мови не потрібно.
 * Відносні імпорти, не `simplycms/i18n`: Playwright-раннер не гарантовано
 * читає `paths` кореневого `tsconfig.json` так само, як Vite/vitest.
 */
import { createTranslator } from '../../../packages/simplycms/src/i18n/translator';
import type { UiLocale } from 'simplycms/contracts';
import { toUiLocale } from '../../../packages/simplycms/src/i18n/ui-locale';
import type {
  PartCatalog,
  MessageKey,
} from '../../../packages/simplycms/src/i18n/types';
import { messages as ukBase } from '../../../packages/simplycms/src/i18n/catalogs/uk/base';
import { messages as ukAdmin } from '../../../packages/simplycms/src/i18n/catalogs/uk/admin/index';
import { messages as ukMail } from '../../../packages/simplycms/src/i18n/catalogs/uk/mail';
/**
 * Мова прогону — основна мова магазину, яку засіває база (`uk`). Мова вітрини тепер з URL, а
 * не зі збірки (перемикач збірки знесено), тож специ без префікса мови читають каталог `uk`.
 */
const CATALOGS: readonly PartCatalog[] = [ukBase, ukAdmin, ukMail];

/** Мова прогону — код з наявного мовного пакета, а не приведення типу. */
function runLocale(): UiLocale {
  const locale = toUiLocale('uk');
  if (locale === null) throw new Error('e2e: немає мовного пакета «uk»');
  return locale;
}

/** Текст мови прогону для ключа каталогу. */
export function t(key: MessageKey): string {
  return createTranslator(CATALOGS, runLocale())(key);
}
