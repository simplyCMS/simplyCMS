// @vitest-environment jsdom
// К3-Е6д-1: при створенні (`mod = null`) id, відданий діалогу, — і власник фото
// (`modId` у `ModificationFormFields`), і другий аргумент `onCreate`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useFormContext } from 'react-hook-form';
import { I18nProvider } from 'simplycms/i18n';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// Справжні поля тягнуть ImageUpload/admin-server; тут важливий лише `modId`.
vi.mock('../ModificationFormFields', () => ({
  ModificationFormFields: ({ modId }: { modId: string }) => {
    const { register } = useFormContext();
    return (
      <div data-testid="fields" data-mod-id={modId}>
        <input aria-label="name" {...register('name')} />
        <input aria-label="slug" {...register('slug')} />
      </div>
    );
  },
}));
vi.mock('../ModificationStatusControl', () => ({
  ModificationStatusControl: () => null,
}));

import { ModificationDialog } from '../ModificationDialog';

afterEach(() => cleanup());

describe('ModificationDialog: створення з id наперед', () => {
  it('onCreate(values, newId) — той самий id, що й modId полів', async () => {
    const onCreate = vi.fn(async (_v: unknown, id: string) => id);
    render(
      <I18nProvider locale="uk">
        <ModificationDialog
          open
          onOpenChange={vi.fn()}
          productId="p1"
          sectionId={null}
          mod={null}
          newId="new-mod-id"
          onCreate={onCreate}
          onUpdate={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByTestId('fields').getAttribute('data-mod-id')).toBe(
      'new-mod-id',
    );
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('slug'), { target: { value: 'a' } });
    fireEvent.submit(document.body.querySelector('form')!);
    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0]![1]).toBe('new-mod-id');
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ name: 'A', slug: 'a' });
  });
});
