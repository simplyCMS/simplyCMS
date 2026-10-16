// @vitest-environment jsdom
/**
 * Діалог модифікації: `<form>` несе ЛИШЕ поля модифікації — секції цін/залишків
 * ПОЗА нею (інакше їхні кнопки сабмітили б діалог) і є лише в збереженої
 * модифікації. «Застосувати» віддає значення чернетці, id нової — наперед.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResizeObserverStub } from '../../edit/__tests__/test-engine-stub';
import { CardHarness, mod, PRODUCT_ID } from '../../__tests__/card-harness';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const mocks = vi.hoisted(() => ({
  saveProductPricesCommand: vi.fn(async () => ({ count: 0, removedIds: [] })),
  listProductPrices: vi.fn(async () => [] as unknown[]),
  listPriceTypes: vi.fn(async () => [] as unknown[]),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { ModificationDialog } from '../ModificationDialog';

const M1 = '11111111-1111-4111-8111-aaaaaaaaaaaa';
beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function renderDialog(
  m: ReturnType<typeof mod> | null,
  onApply = vi.fn(),
  persisted = true,
) {
  render(
    <CardHarness
      card={{ persistedModificationIds: new Set(persisted && m ? [m.id] : []) }}
    >
      <ModificationDialog
        open
        onOpenChange={vi.fn()}
        productId={PRODUCT_ID}
        sectionId={null}
        mod={m}
        newId="new-mod-id"
        onApply={onApply}
      />
    </CardHarness>,
  );
  return onApply;
}

describe('ModificationDialog', () => {
  it('кнопка «Зберегти ціни» — НЕ нащадок <form> діалогу', () => {
    renderDialog(mod(M1, 'M'));
    const saveButton = screen.getByRole('button', { name: 'Зберегти ціни' });
    const dialogForm = document.body.querySelector('form');
    expect(dialogForm).not.toBeNull();
    expect(saveButton.closest('form')).not.toBe(dialogForm);
  });

  it('секції цін і залишків — лише для збереженої модифікації', () => {
    renderDialog(mod(M1, 'M'), vi.fn(), false);
    expect(screen.queryByRole('button', { name: 'Зберегти ціни' })).toBeNull();
  });

  it('клік «Зберегти ціни» кличе команду цін, а не onApply', async () => {
    const onApply = renderDialog(mod(M1, 'M'));
    screen.getByRole('button', { name: 'Зберегти ціни' }).click();
    await vi.waitFor(() =>
      expect(mocks.saveProductPricesCommand).toHaveBeenCalledTimes(1),
    );
    expect(onApply).not.toHaveBeenCalled();
  });

  it('створення: onApply(newId, значення) — той самий id', async () => {
    const onApply = renderDialog(null);
    fireEvent.change(document.getElementById('mod-name')!, {
      target: { value: 'A' },
    });
    fireEvent.change(document.getElementById('mod-slug')!, {
      target: { value: 'a' },
    });
    fireEvent.submit(document.body.querySelector('form')!);
    await vi.waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0]![0]).toBe('new-mod-id');
    expect(onApply.mock.calls[0]![1]).toMatchObject({
      names: { uk: 'A' },
      tokens: { uk: 'a' },
    });
  });

  it('порожня назва основної мови або токен не за форматом — onApply НЕ викликано', async () => {
    const onApply = renderDialog(null);
    fireEvent.submit(document.body.querySelector('form')!);
    await screen.findAllByRole('alert');
    fireEvent.change(document.getElementById('mod-name')!, {
      target: { value: 'A' },
    });
    fireEvent.change(document.getElementById('mod-slug')!, {
      target: { value: 'Bad Token' },
    });
    fireEvent.submit(document.body.querySelector('form')!);
    await new Promise((r) => setTimeout(r, 50));
    expect(onApply).not.toHaveBeenCalled();
  });
});
