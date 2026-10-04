import { describe, expect, it } from 'vitest';
import { hasIdField } from '../insert-scan';

// Е5б Task 8 (H): розпізнавання поля `id` спільного сканера вставок.
// Знахідка Task 3: шортхенд `{ id, … }` давав хибну червону ознаку, і
// автори писали `id: id` в обхід гейту. Розширення не сміє зробити
// зеленою справжню вставку без `id` — негативні контролі нижче.
describe('hasIdField: поле id у payload вставки', () => {
  it.each([
    ['ключ зі значенням', '{ id: randomUUID(), name }'],
    ['шортхенд першим', '{ id, name: x }'],
    ['шортхенд останнім', '{ name: x, id }'],
    ['шортхенд єдиним', '{ id }'],
    ['шортхенд у багаторядковому літералі', '{\n  id,\n  orderId,\n  name,\n}'],
    ['шортхенд після спреду', '{ ...rest, id }'],
  ])('%s → є id', (_name, payload) => {
    expect(hasIdField(payload)).toBe(true);
  });

  it.each([
    ['вставка без id', '{ name: x, quantity: 2 }'],
    ['чужа колонка-шортхенд', '{ productId, name }'],
    ['чужа колонка snake_case', '{ product_id: x, name }'],
    ['ids — не id', '{ ids, name }'],
    ['змінна id як ЗНАЧЕННЯ чужого ключа', '{ orderItemId: id }'],
    ['змінна id як значення посеред літерала', '{ orderId: id, name }'],
    ['порожній payload (без values())', ''],
  ])('%s → id немає (гейт червоний)', (_name, payload) => {
    expect(hasIdField(payload)).toBe(false);
  });
});
