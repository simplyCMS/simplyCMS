import type { Catalog } from '../../../types';

/** Server validation errors (`ValidationError`, Тема 12) — mirror of `uk/admin/validation.ts`. */
export const messages: Catalog = {
  'admin.validation.failed':
    'The data did not pass validation — fix the fields and try again',
  'admin.validation.invalid_type': 'Invalid value type',
  'admin.validation.too_big': 'Value is too large: at most {maximum}',
  'admin.validation.too_big_string': 'Too long: at most {maximum} characters',
  'admin.validation.too_big_array': 'Too many items: at most {maximum}',
  'admin.validation.too_small': 'Value is too small: at least {minimum}',
  'admin.validation.too_small_string':
    'Too short: at least {minimum} characters',
  'admin.validation.too_small_array': 'Too few items: at least {minimum}',
  'admin.validation.invalid_format': 'Invalid value format',
  'admin.validation.invalid_value': 'Value is not allowed',
  'admin.validation.invalid_union': 'Invalid value',
  'admin.validation.invalid_key': 'Invalid key',
  'admin.validation.invalid_element': 'Invalid item',
  'admin.validation.not_multiple_of':
    'Value must be a multiple of {multipleOf}',
  'admin.validation.unrecognized_keys': 'Unknown fields in the request',
  'admin.validation.invalid_decimal':
    'Enter a number: up to {precision} digits, {scale} after the decimal point',
  'admin.validation.invalid_decimal_plain': 'Enter a number',
  'admin.validation.custom': 'Invalid value',
};
