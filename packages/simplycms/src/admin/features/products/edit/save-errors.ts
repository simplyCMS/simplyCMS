import { toast } from 'sonner';
import type { Translator } from 'simplycms/i18n';
import { adminErrorKey } from '../../../lib/admin-error';
import { applyServerValidation } from '../../../lib/apply-server-validation';
import type { SaveIndex } from './product-save-input';

/** Куди класти помилки, що стосуються не поля форми, а рядка картки. */
export interface ErrorSink {
  readonly setFormError: (name: string, message: string) => void;
  readonly setModificationError: (id: string, message: string) => void;
  readonly setValueError: (propertyId: string, message: string) => void;
}

/**
 * Шлях проблеми сервера → адресат на картці. `texts.<мова>.<поле>` — поле форми,
 * `modifications.upsert.<i>…` і `propertyValues.upsert.<i>…` — рядок за тим
 * самим порядком, у якому `buildSaveInput` склав запит (`index`).
 */
function target(path: readonly (string | number)[], index: SaveIndex) {
  if (path[0] === 'texts' && path.length === 3)
    return `texts.${path[1]}.${path[2]}`;
  if (path[0] === 'path' && path.length === 1) return 'path';
  const i = path[2];
  if (path[1] === 'upsert' && typeof i === 'number') {
    if (path[0] === 'modifications' && index.modifications[i])
      return `mod:${index.modifications[i]}`;
    if (path[0] === 'propertyValues' && index.propertyValues[i])
      return `val:${index.propertyValues[i]}`;
  }
  return null;
}

/** Помилка збереження → поле/рядок, інакше локалізований тост. */
export function reportSaveError(
  e: unknown,
  t: Translator,
  index: SaveIndex,
  sink: ErrorSink,
): void {
  const rest = applyServerValidation(
    e,
    (field, err) => {
      if (field.startsWith('mod:'))
        sink.setModificationError(field.slice(4), err.message);
      else if (field.startsWith('val:'))
        sink.setValueError(field.slice(4), err.message);
      else sink.setFormError(field, err.message);
    },
    { t, fieldFor: (p) => target(p, index) },
  );
  if (rest === null) {
    const key = adminErrorKey(e);
    toast.error(key ? t(key) : `${t('common.error')} ${(e as Error).message}`);
  } else if (rest.length > 0) toast.error(t('admin.validation.failed'));
}
