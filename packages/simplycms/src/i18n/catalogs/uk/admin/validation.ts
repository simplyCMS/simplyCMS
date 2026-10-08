/**
 * Помилки валідації, що прийшли з сервера (`ValidationError`, Тема 12) —
 * по одному ключу на код проблеми (`VALIDATION_ISSUE_CODES`) і, де це змінює
 * сенс, на «походження» (`origin`: число/рядок/масив). Мапляться
 * `applyServerValidation` (`admin/lib/apply-server-validation.ts`).
 */
export const messages = {
  'admin.validation.failed':
    'Дані не пройшли перевірку — виправте поля й спробуйте ще раз',
  'admin.validation.invalid_type': 'Некоректний тип значення',
  'admin.validation.too_big': 'Значення завелике: не більше {maximum}',
  'admin.validation.too_big_string':
    'Занадто довго: не більше {maximum} символів',
  'admin.validation.too_big_array':
    'Занадто багато елементів: не більше {maximum}',
  'admin.validation.too_small': 'Значення замале: не менше {minimum}',
  'admin.validation.too_small_string':
    'Занадто коротко: не менше {minimum} символів',
  'admin.validation.too_small_array': 'Замало елементів: не менше {minimum}',
  'admin.validation.invalid_format': 'Некоректний формат значення',
  'admin.validation.invalid_value': 'Недопустиме значення',
  'admin.validation.invalid_union': 'Некоректне значення',
  'admin.validation.invalid_key': 'Некоректний ключ',
  'admin.validation.invalid_element': 'Некоректний елемент',
  'admin.validation.not_multiple_of': 'Значення має бути кратним {multipleOf}',
  'admin.validation.unrecognized_keys': 'Невідомі поля у запиті',
  'admin.validation.invalid_decimal':
    'Введіть число: до {precision} цифр, із них {scale} після коми',
  'admin.validation.invalid_decimal_plain': 'Введіть число',
  'admin.validation.custom': 'Некоректне значення',
  'admin.validation.taken': 'Таке значення вже використовується',
} as const;
