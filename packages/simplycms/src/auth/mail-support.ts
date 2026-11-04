import { eq } from 'drizzle-orm';
import type { ContentLocale } from 'simplycms/contracts';
import { withActor } from 'simplycms/db';
import type { Translator } from 'simplycms/i18n';
import {
  loadMailTranslator,
  type MailTransport,
  type scheduleMail,
} from 'simplycms/mail';
import { profiles } from 'simplycms/schema';
import { readLanguages, readStoreProfile, toLocaleSet } from 'simplycms/site';

/** Спільні залежності відправників листів auth (перевизначення для тестів). */
export type MailDeps = {
  readonly schedule?: typeof scheduleMail;
  readonly mailTransport?: MailTransport;
  readonly storeName?: string;
};

/** `profile.name || 'SimplyCMS'` — той самий фолбек, що й в owner:invite. */
export const readStoreName = (): Promise<string> =>
  withActor({ role: 'app_admin' }, readStoreProfile).then(
    (profile) => profile.name || 'SimplyCMS',
  );

/** Основна мова магазину з БД (`languages.is_default`): кінцева ланка вибору мови листа. */
export const readPrimaryLocale = (): Promise<ContentLocale> =>
  withActor(
    { role: 'app_admin' },
    async (db) => toLocaleSet(await readLanguages(db)).primary,
  );

/**
 * Транслятор листа користувачу: мова інтерфейсу з його профілю (`profiles.ui_locale`),
 * інакше основна мова магазину (§19.9). Профіль ще може не існувати (лист підтвердження
 * йде при реєстрації) — це не помилка, а `null`. Читання під `app_admin`: відправник листа
 * — серверний код без сесії одержувача (скидання пароля).
 */
export async function loadUserMailTranslator(
  userId: string,
): Promise<Translator> {
  const [primary, uiLocale] = await withActor(
    { role: 'app_admin' },
    async (db) => {
      const [row] = await db
        .select({ uiLocale: profiles.uiLocale })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      return [
        toLocaleSet(await readLanguages(db)).primary,
        row?.uiLocale ?? null,
      ] as const;
    },
  );
  return loadMailTranslator({ kind: 'user', uiLocale, locale: null }, primary);
}

/**
 * Помилка фонової доставки без секретів: лише мітка листа і клас помилки —
 * ні тексту (там може бути адреса), ні посилання.
 */
export const logDeliveryFailure =
  (label: string) =>
  (error: unknown): void => {
    console.warn(
      `[simplycms/auth] фонова доставка листа ${label} не вдалась:`,
      error instanceof Error ? error.name : typeof error,
    );
  };
