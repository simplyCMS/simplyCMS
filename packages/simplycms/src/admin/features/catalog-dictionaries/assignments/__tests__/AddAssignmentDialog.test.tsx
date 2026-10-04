// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import { ID, PROPS } from '../../properties/__tests__/render-support';

// Е5б Task 8 (E): юніт діалогу призначення. Radix Select у jsdom 30 не
// працює (немає hasPointerCapture/scrollIntoView, див. ProductsPage.test.tsx)
// — замокано нативним <select> з тим самим контрактом value/onValueChange.
vi.mock('simplycms/ui/select', () => ({
  Select: (p: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="property"
      value={p.value}
      onChange={(e) => p.onValueChange(e.target.value)}
    >
      <option value="" />
      {p.children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: (p: { children: ReactNode }) => <>{p.children}</>,
  SelectItem: (p: { value: string; children: ReactNode }) => (
    <option value={p.value}>{p.children}</option>
  ),
}));

import { AddAssignmentDialog } from '../AddAssignmentDialog';

const t = createTranslator('uk');
afterEach(cleanup);

function setup(properties = PROPS) {
  const onAdd = vi.fn();
  const onOpenChange = vi.fn();
  const ui = (open: boolean) => (
    <I18nProvider locale="uk">
      <AddAssignmentDialog
        open={open}
        onOpenChange={onOpenChange}
        appliesTo="product"
        properties={properties}
        onAdd={onAdd}
      />
    </I18nProvider>
  );
  const view = render(ui(true));
  return { onAdd, onOpenChange, reopen: () => view.rerender(ui(true)), ui };
}

const addButton = () =>
  screen.getByRole('button', { name: t('common.add') }) as HTMLButtonElement;
const pick = (id: string) =>
  fireEvent.change(screen.getByLabelText('property'), {
    target: { value: id },
  });

describe('AddAssignmentDialog', () => {
  it('порожній список → підказка allAdded, кнопка «Додати» вимкнена', () => {
    setup([]);
    expect(
      screen.getByText(t('admin.properties.section.allAdded')),
    ).toBeTruthy();
    expect(addButton().disabled).toBe(true);
  });

  it('вибір → onAdd(selected) і закриття діалогу', () => {
    const { onAdd, onOpenChange } = setup();
    expect(addButton().disabled).toBe(true);
    pick(ID.weight);
    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledWith(ID.weight);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('закриття «Скасувати» скидає вибір: повторне відкриття — кнопка знову вимкнена', () => {
    const { onAdd, onOpenChange, reopen } = setup();
    pick(ID.brand);
    expect(addButton().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    reopen();
    expect(addButton().disabled).toBe(true);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
