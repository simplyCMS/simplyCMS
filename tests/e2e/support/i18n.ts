/**
 * Локалізований текст для селекторів у специфікаціях.
 *
 * 🔴 Кнопки/лейбли залежать від локалі (`t('auth.login.submit')` тощо), тож
 * специ читають ТОЙ САМИЙ транслятор, що й застосунок (включно з fallback
 * en → uk на неповний каталог), а не вгадують рядок під конкретну мову.
 * Відносний імпорт, не `@simplycms/i18n`: Playwright-раннер не гарантовано
 * читає `paths` кореневого `tsconfig.json` так само, як Vite/vitest.
 */
import {
  createTranslator,
  normalizeLocale,
} from '../../../packages/i18n/src/translator';
import type { MessageKey } from '../../../packages/i18n/src/types';
import { e2eLocale } from './env';

/** Текст активної локалі прогону для ключа каталогу. */
export function t(key: MessageKey): string {
  return createTranslator(normalizeLocale(e2eLocale()))(key);
}
