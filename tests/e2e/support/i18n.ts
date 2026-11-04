/**
 * Локалізований текст для селекторів у специфікаціях.
 *
 * 🔴 Кнопки/лейбли залежать від локалі (`t('auth.login.submit')` тощо), тож
 * специ читають ТОЙ САМИЙ транслятор, що й застосунок (включно з fallback
 * en → uk на неповний каталог), а не вгадують рядок під конкретну мову.
 * Відносний імпорт, не `simplycms/i18n`: Playwright-раннер не гарантовано
 * читає `paths` кореневого `tsconfig.json` так само, як Vite/vitest.
 */
import {
  createTranslator,
  languageOfConfigLocale,
} from '../../../packages/simplycms/src/i18n/translator';
import { toUiLocale } from '../../../packages/simplycms/src/i18n/ui-locale';
import type { MessageKey } from '../../../packages/simplycms/src/i18n/types';
import { e2eLocale } from './env';

/** Мова інтерфейсу з пакета, а не з довільного рядка: хибний код прогону — помилка, не тихий `uk`. */
function uiOf(code: string) {
  const locale = toUiLocale(code);
  if (!locale) throw new Error(`e2e: немає мовного пакета «${code}»`);
  return locale;
}

/** Текст активної локалі прогону для ключа каталогу. */
export function t(key: MessageKey): string {
  return createTranslator(
    uiOf(languageOfConfigLocale(e2eLocale())),
    uiOf('uk'),
  )(key);
}
