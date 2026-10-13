import { withActor } from 'simplycms/db';
import { readStoreProfile } from 'simplycms/site';

/** `profile.name || 'SimplyCMS'` — той самий фолбек, що й в owner:invite. */
export const readStoreName = (): Promise<string> =>
  withActor({ role: 'app_admin' }, readStoreProfile).then(
    (profile) => profile.name || 'SimplyCMS',
  );

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
