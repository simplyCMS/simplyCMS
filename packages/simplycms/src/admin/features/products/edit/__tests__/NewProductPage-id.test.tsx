// @vitest-environment jsdom
// К3-Е6д-1: id нового товару генерується наперед і ОДИН І ТОЙ САМИЙ іде і як
// власник фото (`entityId` форми), і в insert (`create(..., id)`) — ресурс
// звіряє власника файлу з id рядка.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../useProductSave', () => ({
  useProductSave: () => ({ create: mocks.create }),
}));
// Форма підміняється кнопкою: перевіряється лише проводка id, не поля.
vi.mock('../ProductForm', () => ({
  ProductForm: (props: {
    entityId: string;
    onSubmit: (values: unknown, binding: unknown) => void;
  }) => (
    <button
      data-entity-id={props.entityId}
      onClick={() => props.onSubmit({ name: 'x' }, 'binding')}
    >
      submit
    </button>
  ),
}));
vi.mock('simplycms/plugins/PluginSlot', () => ({ PluginSlot: () => null }));

import { NewProductPage } from '../NewProductPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NewProductPage: наперед згенерований id', () => {
  it('create отримує той самий id, що й ImageUpload entityId', () => {
    render(
      <I18nProvider locale="uk">
        <NewProductPage />
      </I18nProvider>,
    );
    const button = screen.getByRole('button', { name: 'submit' });
    const entityId = button.getAttribute('data-entity-id');
    expect(entityId).toMatch(/^[0-9a-f-]{36}$/);
    fireEvent.click(button);
    expect(mocks.create).toHaveBeenCalledWith(
      { name: 'x' },
      'binding',
      entityId,
    );
  });
});
