import { describe, expect, it } from 'vitest';
import { callArgument, hasIdField } from '../insert-scan';

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

// Фінальний прохід архітектора (M1): регекс дивився на текст УСЬОГО payload,
// тож один елемент масиву з `id` рятував решту, а `id:` у коментарі чи
// рядку рахувався полем. Кейси йдуть через `callArgument` — як у реальному
// скані (`.values([...])` розгортається в елементи через кому).
const valuesPayload = (call: string): string =>
  callArgument(call, call.indexOf('.values(') + '.values('.length - 1);

describe('hasIdField: масиви, коментарі й рядки (M1)', () => {
  it.each([
    [
      'масив: один елемент без id',
      ".values([{ name: 'a' }, { id: 'x', name: 'b' }])",
    ],
    [
      'масив: id лише в першому, другий без',
      ".values([{ id: 'x', name: 'a' }, { name: 'b' }])",
    ],
    [
      'багаторядковий масив із елементом без id',
      ".values([\n  {\n    id: 'x',\n    name: 'a',\n  },\n  {\n    name: 'b',\n  },\n])",
    ],
    [
      'масив із шортхендом і елементом без id',
      '.values([{ id, name }, { name: b }])',
    ],
    ['id: лише в рядковому коментарі', ".values({ name: 'a' // id: x\n})"],
    ['id: лише в блоковому коментарі', ".values({ /* id: x */ name: 'a' })"],
    ['id: лише в рядковому літералі', ".values({ name: 'id: x' })"],
    ['id: лише в шаблонному літералі', '.values({ name: `{ id: 1 }` })'],
    ['шортхенд лише в рядку', ".values({ name: '{ id, }' })"],
  ])('%s → offender', (_name, call) => {
    expect(hasIdField(valuesPayload(call))).toBe(false);
  });

  it.each([
    [
      'усі елементи масиву з id',
      ".values([{ id: 'x', name: 'a' }, { id: 'y', name: 'b' }])",
    ],
    [
      'багаторядковий масив, усі з id',
      '.values([\n  { id, name: a },\n  { id: randomUUID(), name: b },\n])',
    ],
    ['{ ...rest, id }', '.values({ ...rest, id })'],
    ['{ ...rest, id } в масиві', '.values([{ ...rest, id }, { id: x }])'],
    ['id після коментаря', ".values({ // ключ\n  id: x, name: 'a' })"],
    ['рядок із комою не ділить елемент', ".values({ id: x, name: 'a, b' })"],
    ['map-вставка з id', '.values(rows.map((r) => ({ id: r.id, name: r.n })))'],
  ])('%s → є id', (_name, call) => {
    expect(hasIdField(valuesPayload(call))).toBe(true);
  });
});
