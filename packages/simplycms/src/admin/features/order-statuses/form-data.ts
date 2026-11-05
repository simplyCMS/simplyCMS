import { TRANSLATABLE_FIELDS } from 'simplycms/domain/translations';

/** Перекладні поля статусу й обовʼязкові в основній мові — з реєстру, не літералами. */
export const STATUS_FIELDS = TRANSLATABLE_FIELDS.orderStatus
  .fields as readonly ['name'];
export const STATUS_REQUIRED = TRANSLATABLE_FIELDS.orderStatus
  .required as readonly 'name'[];

/** Неперекладна частина форми статусу (тексти живуть у формі набору `useTranslatableTexts`). */
export interface StatusBaseForm {
  code: string;
  color: string;
  isDefault: boolean;
}

export const EMPTY_STATUS_BASE: StatusBaseForm = {
  code: '',
  color: '#6B7280',
  isDefault: false,
};

/** Код зі зрозумілої назви: нижній регістр, підкреслення, до 20 символів. */
export const generateStatusCode = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 20);
