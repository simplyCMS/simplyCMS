/**
 * Локалізований текст для селекторів у специфікаціях.
 *
 * 🔴 Кнопки/лейбли залежать від локалі (`t('auth.login.submit')` тощо), тож
 * специ читають ТОЙ САМИЙ каталог, що й застосунок, а не вгадують рядок під конкретну
 * мову. Частини каталогу тут статичні (раннер синхронний, реєстр ледачий — асинхронний),
 * повнота `en` — типом (`satisfies`), тож fallback-мови не потрібно.
 * Відносні імпорти, не `simplycms/i18n`: Playwright-раннер не гарантовано
 * читає `paths` кореневого `tsconfig.json` так само, як Vite/vitest.
 */
import {
  createTranslator,
  languageOfConfigLocale,
} from '../../../packages/simplycms/src/i18n/translator';
import { toUiLocale } from '../../../packages/simplycms/src/i18n/ui-locale';
import type {
  MessageKey,
  PartCatalog,
} from '../../../packages/simplycms/src/i18n/types';
import { messages as ukBase } from '../../../packages/simplycms/src/i18n/catalogs/uk/base';
import { messages as ukAdmin } from '../../../packages/simplycms/src/i18n/catalogs/uk/admin/index';
import { messages as ukMail } from '../../../packages/simplycms/src/i18n/catalogs/uk/mail';
import { messages as enBase } from '../../../packages/simplycms/src/i18n/catalogs/en/base';
import { messages as enAdmin } from '../../../packages/simplycms/src/i18n/catalogs/en/admin/index';
import { messages as enMail } from '../../../packages/simplycms/src/i18n/catalogs/en/mail';
import { e2eLocale } from './env';

const CATALOGS: Record<string, readonly PartCatalog[]> = {
  uk: [ukBase, ukAdmin, ukMail],
  en: [enBase, enAdmin, enMail],
};

/** Каталоги мови зі списку пакетів, а не з довільного рядка: хибний код прогону — помилка, не тихий `uk`. */
function catalogsOf(code: string): readonly PartCatalog[] {
  const locale = toUiLocale(code);
  const catalogs = locale === null ? undefined : CATALOGS[locale];
  if (!catalogs) throw new Error(`e2e: немає мовного пакета «${code}»`);
  return catalogs;
}

/** Текст активної локалі прогону для ключа каталогу. */
export function t(key: MessageKey): string {
  return createTranslator(catalogsOf(languageOfConfigLocale(e2eLocale())))(key);
}
