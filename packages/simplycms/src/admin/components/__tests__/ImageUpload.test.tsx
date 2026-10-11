// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

const mocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

import { ImageUpload } from '../ImageUpload';

afterEach(() => cleanup());

const removeFirst = (eraseOnRemove?: boolean) => {
  const onImagesChange = vi.fn();
  const { container } = render(
    <I18nProvider locale="uk">
      <ImageUpload
        images={['product/a.png']}
        onImagesChange={onImagesChange}
        entityType="product"
        eraseOnRemove={eraseOnRemove}
      />
    </I18nProvider>,
  );
  fireEvent.click(container.querySelector('.lucide-x')!.closest('button')!);
  return onImagesChange;
};

describe('ImageUpload.eraseOnRemove', () => {
  it('без пропа — прибирання кличе deleteMedia (поведінка інших сутностей)', async () => {
    const onChange = removeFirst();
    expect(onChange).toHaveBeenCalledWith([]);
    await waitFor(() =>
      expect(mocks.deleteMedia).toHaveBeenCalledWith({
        data: { ref: 'product/a.png' },
      }),
    );
  });

  it('eraseOnRemove={false} — файл не стирається, референс лише знімається з форми', async () => {
    mocks.deleteMedia.mockClear();
    const onChange = removeFirst(false);
    expect(onChange).toHaveBeenCalledWith([]);
    await Promise.resolve();
    expect(mocks.deleteMedia).not.toHaveBeenCalled();
  });

  it('409 media_in_use → зрозумілий тост, форма не ламається (Е6д-22)', async () => {
    mocks.toast.mockClear();
    mocks.deleteMedia.mockRejectedValueOnce({
      name: 'AdminConflictError',
      kind: 'state',
      constraint: 'media_in_use',
    });
    removeFirst();
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        description: expect.stringContaining('ще використовується'),
      }),
    );
  });
});
