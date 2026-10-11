// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { I18nProvider } from 'simplycms/i18n';
import { ACCEPT_ATTRIBUTE } from 'simplycms/domain/media';
import { ReviewImagePicker } from '../ReviewImagePicker';

afterEach(cleanup);

const created: string[] = [];
const revoke = vi.fn();
beforeEach(() => {
  created.length = 0;
  revoke.mockReset();
  // jsdom не має URL.createObjectURL/revokeObjectURL.
  URL.createObjectURL = () => {
    const url = `blob:mock-${created.length}`;
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = revoke;
});

const img = (name: string, over: Partial<File> = {}) => {
  const f = new File([new Uint8Array([1])], name, { type: 'image/png' });
  return Object.assign(f, over);
};

/** Керований обгортач: пікер — контрольований компонент. */
function Harness({
  maxBytes = 5 * 1024 * 1024,
  initial = [],
}: {
  maxBytes?: number;
  initial?: File[];
}) {
  const [files, setFiles] = useState<File[]>(initial);
  return (
    <ReviewImagePicker
      files={files}
      onFilesChange={setFiles}
      maxFiles={5}
      accept={ACCEPT_ATTRIBUTE}
      maxBytes={maxBytes}
    />
  );
}

const mount = (maxBytes?: number, initial?: File[]) =>
  render(
    <I18nProvider locale="uk">
      <Harness maxBytes={maxBytes} initial={initial} />
    </I18nProvider>,
  );

const input = () => screen.getByTestId('review-images-input');
const pick = (files: File[]) =>
  fireEvent.change(input(), { target: { files } });

describe('ReviewImagePicker', () => {
  it('вибір 2 файлів дає 2 превʼю; прибрати одне лишає 1 і ревокує URL', () => {
    const { container } = mount();
    pick([img('a.png'), img('b.png')]);
    expect(container.querySelectorAll('img')).toHaveLength(2);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Прибрати фото' })[0],
    );
    expect(container.querySelectorAll('img')).toHaveLength(1);
    // Ревокується рівно URL прибраного (першого) файла, другий живий.
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:mock-0');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'blob:mock-1',
    );
  });

  it('монтування з початковими файлами лишає превʼю чинними', () => {
    const { container } = mount(undefined, [img('a.png'), img('b.png')]);
    expect(revoke).not.toHaveBeenCalled();
    const srcs = [...container.querySelectorAll('img')].map((i) =>
      i.getAttribute('src'),
    );
    expect(srcs).toEqual(['blob:mock-0', 'blob:mock-1']);
  });

  it('6-й файл не додається, видно повідомлення', () => {
    const { container } = mount();
    pick([1, 2, 3, 4, 5].map((n) => img(`${n}.png`)));
    pick([img('6.png')]);
    expect(container.querySelectorAll('img')).toHaveLength(5);
    expect(screen.getByRole('alert').textContent).toBe('Не більше 5 фото');
  });

  it('завеликий файл відкидається з повідомленням', () => {
    const { container } = mount(0);
    pick([img('big.png')]);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toBe('Фото більше 5 МБ');
  });

  it('не зображення відкидається з повідомленням про формат', () => {
    const { container } = mount();
    pick([new File(['x'], 'a.txt', { type: 'text/plain' })]);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toContain('PNG, JPEG');
  });

  it('розмонтування ревокує превʼю', () => {
    const { unmount } = mount();
    pick([img('a.png')]);
    revoke.mockClear();
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:mock-0');
  });

  it('заміна файла ревокує URL старого і створює URL для нового', () => {
    const a = img('a.png');
    const b = img('b.png');
    const view = (files: File[]) => (
      <I18nProvider locale="uk">
        <ReviewImagePicker
          files={files}
          onFilesChange={() => {}}
          maxFiles={5}
          accept={ACCEPT_ATTRIBUTE}
          maxBytes={1024}
        />
      </I18nProvider>
    );
    const { container, rerender } = render(view([a]));
    expect(created).toEqual(['blob:mock-0']);
    rerender(view([b]));
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:mock-0');
    expect(created).toEqual(['blob:mock-0', 'blob:mock-1']);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'blob:mock-1',
    );
    rerender(view([]));
    expect(revoke).toHaveBeenLastCalledWith('blob:mock-1');
  });
});
