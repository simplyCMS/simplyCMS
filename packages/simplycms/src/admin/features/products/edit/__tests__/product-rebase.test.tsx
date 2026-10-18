// @vitest-environment jsdom
/**
 * Перечитування після власного збереження (Task 18 п. 10.3, принцип рішення
 * власника Task 13 «saveStock не затирає незбережений статус»): введене ПІСЛЯ
 * відправки лишається значенням користувача І лишається зміною (форма dirty);
 * елемент колекції, якого він після відправки не чіпав, бере паралельну зміну з БД.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { blankForm } from '../product-aggregate';
import type { ProductFormValues } from '../product-form-schema';
import { rebase, resetAfterSave } from '../product-rebase';

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const M3 = '33333333-3333-4333-8333-333333333333';
const mod = (id: string, sku = '') => ({
  id,
  sku,
  isDefault: false,
  sortOrder: 0,
  stockStatus: 'in_stock' as const,
  texts: { uk: 'М', en: '' },
  token: {},
});
const sentForm = (): ProductFormValues => {
  const f = blankForm(['uk', 'en']);
  f.texts.uk!.name = 'Панель 1';
  f.modifications = [mod(M1), mod(M2)];
  return f;
};

afterEach(cleanup);

/** Форма в стані «запит відправлено, користувач щось ввів під час нього». */
function formAfter(edit: (f: ProductFormValues) => void) {
  // formState — проксі з підпискою: читаємо його в рендері, як компонент форми.
  const { result } = renderHook(() => {
    const form = useForm<ProductFormValues>({ defaultValues: sentForm() });
    void form.formState.isDirty;
    void form.formState.dirtyFields;
    return form;
  });
  const now = sentForm();
  edit(now);
  act(() => result.current.reset(now, { keepDefaultValues: true }));
  return result;
}

describe('resetAfterSave', () => {
  it('🔴 поле, змінене під час збереження: значення користувача, форма dirty', () => {
    const form = formAfter((f) => (f.texts.uk!.name = 'Панель 12'));
    const fresh = sentForm();
    act(() => resetAfterSave(form.current, fresh, sentForm()));
    expect(form.current.getValues('texts.uk.name')).toBe('Панель 12');
    expect(form.current.formState.isDirty).toBe(true);
    expect(form.current.formState.dirtyFields.texts?.uk?.name).toBe(true);
  });

  it('нічого не змінено після відправки — форма чиста й дорівнює БД', () => {
    const form = formAfter(() => {});
    const fresh = sentForm();
    fresh.texts.en!.name = 'Panel (з БД)';
    act(() => resetAfterSave(form.current, fresh, sentForm()));
    expect(form.current.getValues('texts.en.name')).toBe('Panel (з БД)');
    expect(form.current.formState.isDirty).toBe(false);
  });
});

describe('rebase: колекції по елементах', () => {
  it('🔴 не чіпаний після відправки елемент — з БД, змінений — користувача', () => {
    const now = sentForm();
    now.modifications[1] = mod(M2, 'MINE');
    const fresh = sentForm();
    fresh.modifications[0] = mod(M1, 'DB');
    fresh.modifications[1] = mod(M2, 'DB');
    expect(
      rebase(fresh, sentForm(), now).modifications.map((m) => m.sku),
    ).toEqual(['DB', 'MINE']);
  });

  it('склад змінено після відправки: порядок користувача, додане паралельно — в кінці', () => {
    const now = sentForm();
    now.modifications = [mod(M2), mod(M1, 'NEW')];
    const fresh = sentForm();
    fresh.modifications = [mod(M1), mod(M2, 'DB'), mod(M3)];
    expect(
      rebase(fresh, sentForm(), now).modifications.map((m) => [m.id, m.sku]),
    ).toEqual([
      [M2, 'DB'],
      [M1, 'NEW'],
      [M3, ''],
    ]);
  });

  // Фікс-раунд 1 Task 18 (M9): одне правило «чуже видалення» для обох гілок порядку.
  describe('інший редактор видалив елемент під час збереження', () => {
    const deletedM2 = () => {
      const fresh = sentForm();
      fresh.modifications = [mod(M1)];
      return fresh;
    };

    it('🔴 (а) змінив елемент, сервер його видалив → елемент лишається з правкою (склад не мінявся)', () => {
      const now = sentForm();
      now.modifications[1] = mod(M2, 'MINE');
      expect(
        rebase(deletedM2(), sentForm(), now).modifications.map((m) => [
          m.id,
          m.sku,
        ]),
      ).toEqual([
        [M1, ''],
        [M2, 'MINE'],
      ]);
    });

    it('🔴 (а) те саме, коли склад змінено (переставлено) — правка теж лишається', () => {
      const now = sentForm();
      now.modifications = [mod(M2, 'MINE'), mod(M1)];
      expect(
        rebase(deletedM2(), sentForm(), now).modifications.map((m) => [
          m.id,
          m.sku,
        ]),
      ).toEqual([
        [M2, 'MINE'],
        [M1, ''],
      ]);
    });

    it('(б) не змінював, сервер видалив → елемент зникає (обидві гілки)', () => {
      expect(
        rebase(deletedM2(), sentForm(), sentForm()).modifications.map(
          (m) => m.id,
        ),
      ).toEqual([M1]);
      const swapped = sentForm();
      swapped.modifications = [mod(M2), mod(M1)];
      expect(
        rebase(deletedM2(), sentForm(), swapped).modifications.map((m) => m.id),
      ).toEqual([M1]);
    });

    it('правка видаленого елемента лишається зміною форми (dirty)', () => {
      const form = formAfter((f) => (f.modifications[1] = mod(M2, 'MINE')));
      act(() => resetAfterSave(form.current, deletedM2(), sentForm()));
      expect(form.current.getValues('modifications').map((m) => m.sku)).toEqual(
        ['', 'MINE'],
      );
      expect(form.current.formState.isDirty).toBe(true);
    });
  });
});
