import { getLanguagePack } from 'simplycms/i18n';

/**
 * Чи є для мови вбудований мовний пакет інтерфейсу (`uk`, `en`). Адмінка мов
 * показує це прапорцем: мова без пакета працює, але інтерфейс на ній падає на
 * основну. Живе в `site` (а не в `admin-server`), бо `site` уже вправі
 * імпортувати `i18n`, а серверному шару адмінки цей виняток не потрібен.
 */
export const hasLanguagePack = (code: string): boolean =>
  getLanguagePack(code) !== null;
