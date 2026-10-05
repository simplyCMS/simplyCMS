import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from 'simplycms/i18n';
import { adminErrorKey } from './admin-error';
import { applyServerValidation } from './apply-server-validation';

/**
 * Помилки полів форм без react-hook-form (редактори залишків/цін) — стан +
 * єдиний розбір відмови збереження (Тема 12): помилка валідації сервера →
 * повідомлення під полем; усе, що до поля не привʼязалось, і будь-яка інша
 * помилка → ОДИН тост. Для RHF-форм поля веде сам `form.setError`, а тост
 * лишається за викликачем (`applyServerValidation` напряму).
 */
export function useServerFieldErrors() {
  const t = useT();
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  const reset = () => setErrors({});

  /** Прибрати помилку одного поля, коли користувач його змінив. */
  const clear = (field: string) =>
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  /**
   * @param fieldFor позиційний `path` → ключ поля (див. `applyServerValidation`).
   * @param fallback текст тоста для не-валідаційної помилки без ключа
   *   (за замовчуванням «Помилка <message>»).
   */
  const handle = (
    error: unknown,
    opts: {
      readonly fieldFor?: (path: readonly (string | number)[]) => string | null;
      readonly fallback?: (error: unknown) => string;
    } = {},
  ) => {
    const rest = applyServerValidation(
      error,
      (field, e) => setErrors((prev) => ({ ...prev, [field]: e.message })),
      { t, fieldFor: opts.fieldFor },
    );
    if (rest === null) {
      const key = adminErrorKey(error);
      toast.error(
        key
          ? t(key)
          : opts.fallback
            ? opts.fallback(error)
            : `${t('common.error')} ${(error as Error).message}`,
      );
    } else if (rest.length > 0) {
      toast.error(t('admin.validation.failed'));
    }
  };

  return { errors, reset, clear, handle };
}
