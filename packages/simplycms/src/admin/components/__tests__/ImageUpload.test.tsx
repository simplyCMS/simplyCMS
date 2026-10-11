// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

const mocks = vi.hoisted(() => ({
  uploadMedia: vi.fn(),
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

describe('ImageUpload: прибирання з форми', () => {
  it('лише знімає референс; файл стирає збереження форми, а не компонент', async () => {
    const onImagesChange = vi.fn();
    const { container } = render(
      <I18nProvider locale="uk">
        <ImageUpload
          images={['product/a.png']}
          onImagesChange={onImagesChange}
          entityType="product"
          entityId="ab000000-0000-4000-8000-000000000000"
        />
      </I18nProvider>,
    );
    fireEvent.click(container.querySelector('.lucide-x')!.closest('button')!);
    expect(onImagesChange).toHaveBeenCalledWith([]);
    await Promise.resolve();
  });
});
