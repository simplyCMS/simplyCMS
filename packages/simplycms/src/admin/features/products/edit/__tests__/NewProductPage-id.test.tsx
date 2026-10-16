// @vitest-environment jsdom
// К3-Е6д-1: id нового товару генерується наперед і ОДИН І ТОЙ САМИЙ іде і як
// власник фото (`entityId` картки), і в `products.create` (`useProductCreate`).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

const mocks = vi.hoisted(() => ({
  useProductCreate: vi.fn((_id: string) => vi.fn()),
}));
vi.mock('../useProductSave', () => ({
  useProductCreate: mocks.useProductCreate,
}));
vi.mock('../useProductAggregate', () => ({
  useProductLanguages: () => ({
    data: [{ code: 'uk', name: 'Українська', isDefault: true }],
  }),
}));
// Форма підміняється маркером: перевіряється лише проводка id, не поля.
vi.mock('../ProductForm', () => ({
  ProductForm: (props: { card: { entityId: string } }) => (
    <i data-testid="form" data-entity-id={props.card.entityId} />
  ),
}));
vi.mock('simplycms/plugins/PluginSlot', () => ({ PluginSlot: () => null }));

import { NewProductPage } from '../NewProductPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NewProductPage: наперед згенерований id', () => {
  it('create отримує той самий id, що й власник фото в картці', () => {
    render(
      <I18nProvider locale="uk">
        <NewProductPage />
      </I18nProvider>,
    );
    const entityId = screen.getByTestId('form').getAttribute('data-entity-id');
    expect(entityId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.useProductCreate.mock.calls[0]![0]).toBe(entityId);
  });
});
