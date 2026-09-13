// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';

const uploadMyAvatar = vi.fn();
const removeMyAvatar = vi.fn();
vi.mock('simplycms/core/lib/profile-avatar', () => ({
  uploadMyAvatar: (...args: unknown[]) => uploadMyAvatar(...args),
  removeMyAvatar: (...args: unknown[]) => removeMyAvatar(...args),
}));

import { AvatarUpload } from '../AvatarUpload';

const png = () =>
  new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], 'a.png', {
    type: 'image/png',
  });

const mount = (props: Partial<Parameters<typeof AvatarUpload>[0]> = {}) =>
  render(
    <I18nProvider locale="uk">
      <AvatarUpload currentAvatarUrl={null} onUpdate={vi.fn()} {...props} />
    </I18nProvider>,
  );

const input = () => screen.getByTestId('avatar-file-input') as HTMLInputElement;

beforeEach(() => {
  uploadMyAvatar.mockReset();
  removeMyAvatar.mockReset();
});

// 🔴 Четверте обмеження стенда, виміряне тут (план перелічив три): у
// `vitest.config.ts` немає `globals: true`, тож `afterEach` не лежить у
// globalThis — авто-cleanup Testing Library не реєструється, і DOM
// попереднього тесту доживає до наступного (`getByTestId` падає на «знайдено
// два»). Домашній патерн — `CheckoutOrderSummary.test.tsx:66`.
afterEach(() => cleanup());

describe('AvatarUpload', () => {
  // 🔴 Центральний асерт етапу: до Е2 компонент чесно відмовляв, і саме цей
  // прапорець був доказом відмови. Тепер він доказ протилежного.
  it('інпут БІЛЬШЕ НЕ disabled — порт сховища живий', () => {
    mount();
    expect(input().disabled).toBe(false);
  });

  it('вибір файлу кличе serverFn із FormData і віддає новий URL нагору', async () => {
    uploadMyAvatar.mockResolvedValue({ url: '/media/ab/x.png' });
    const onUpdate = vi.fn();
    mount({ onUpdate });

    fireEvent.change(input(), { target: { files: [png()] } });

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('/media/ab/x.png'),
    );
    expect(uploadMyAvatar).toHaveBeenCalledTimes(1);
    const [[arg]] = uploadMyAvatar.mock.calls as [[{ data: FormData }]];
    expect(arg.data).toBeInstanceOf(FormData);
    expect(arg.data.get('file')).toBeInstanceOf(File);
  });

  it('відмова сервера показує причину й НЕ чіпає поточний аватар', async () => {
    uploadMyAvatar.mockRejectedValue(new Error('avatar/bad-format'));
    const onUpdate = vi.fn();
    mount({ currentAvatarUrl: '/media/ab/old.png', onUpdate });

    fireEvent.change(input(), { target: { files: [png()] } });

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Непідтримуваний формат',
      ),
    );
    expect(onUpdate).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('img') as HTMLImageElement).getAttribute('src'),
    ).toBe('/media/ab/old.png');
  });

  it('невідома помилка дає загальне повідомлення, а не текст винятку', async () => {
    uploadMyAvatar.mockRejectedValue(new Error('ECONNRESET'));
    mount();
    fireEvent.change(input(), { target: { files: [png()] } });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Не вдалося зберегти фото',
      ),
    );
  });

  it('кнопка видалення є лише за наявного аватара і кличе removeMyAvatar', async () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Видалити фото' })).toBeNull();

    removeMyAvatar.mockResolvedValue(undefined);
    const onUpdate = vi.fn();
    mount({ currentAvatarUrl: '/media/ab/x.png', onUpdate });
    fireEvent.click(screen.getByRole('button', { name: 'Видалити фото' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(null));
  });

  it('без аватара показує ініціали', () => {
    mount({ firstName: 'Іван', lastName: 'Петренко' });
    expect(screen.getByText('ІП')).toBeTruthy();
  });

  it('файл понад стелю не доходить до сервера', async () => {
    mount();
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    fireEvent.change(input(), { target: { files: [big] } });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('завеликий'),
    );
    expect(uploadMyAvatar).not.toHaveBeenCalled();
  });
});
