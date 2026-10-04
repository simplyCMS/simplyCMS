/** Дані форми статусу замовлення. */
export interface StatusFormData {
  name: string;
  code: string;
  color: string;
  is_default: boolean;
}

export const EMPTY_STATUS_FORM: StatusFormData = {
  name: '',
  code: '',
  color: '#6B7280',
  is_default: false,
};

/** Код зі зрозумілої назви: нижній регістр, підкреслення, до 20 символів. */
export const generateStatusCode = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 20);
