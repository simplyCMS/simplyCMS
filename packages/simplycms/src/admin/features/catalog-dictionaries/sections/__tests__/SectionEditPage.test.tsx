// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createTranslator } from 'simplycms/i18n';
import { ROWS, wrapper } from './render-support';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { toastError, toastSuccess, navigate, params } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(),
  params: { sectionId: 'new' },
}));
vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => params,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
// Tiptap і справжнє завантаження файлів — поза юнітом: заглушки з тим самим контрактом props.
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => <div data-testid="rte" />,
}));
vi.mock('../../../../components/ImageUpload', () => ({
  ImageUpload: (p: {
    images: string[];
    onImagesChange: (i: string[]) => void;
    entityType: string;
    entityId?: string | null;
    maxImages?: number;
  }) => (
    <div
      data-testid="image-upload"
      data-entity-type={p.entityType}
      data-entity-id={p.entityId ?? ''}
      data-max={p.maxImages}
    >
      <button
        type="button"
        onClick={() => p.onImagesChange(['section/n/new.jpg'])}
      >
        add-image
      </button>
      <button type="button" onClick={() => p.onImagesChange([])}>
        clear-image
      </button>
    </div>
  ),
}));

// Панель призначень має власні тести (assignments/__tests__) — тут лише факт монтування.
vi.mock('../../assignments/SectionPropertyAssignmentsPanel', () => ({
  SectionPropertyAssignmentsPanel: (p: { sectionId: string }) => (
    <div data-testid="assignments-panel" data-section-id={p.sectionId} />
  ),
}));

const { listSections, insertSections, updateSections, removeSections } =
  vi.hoisted(() => ({
    listSections: vi.fn(),
    insertSections: vi.fn(),
    updateSections: vi.fn(),
    removeSections: vi.fn(),
  }));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listSections,
    insertSections,
    updateSections,
    removeSections,
  }),
);

import SectionEditPage from '../SectionEditPage';

const t = createTranslator('uk');

const fill = (name: string, slug: string) => {
  fireEvent.change(screen.getByLabelText('Назва'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(t('admin.common.slug')), {
    target: { value: slug },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  params.sectionId = 'new';
  listSections.mockResolvedValue(ROWS);
  insertSections.mockImplementation(async ({ data }) => data);
});
afterEach(() => cleanup());

describe('SectionEditPage', () => {
  it('slug з кирилицею → помилка, insert не викликано', async () => {
    render(<SectionEditPage />, { wrapper });
    fill('Ноутбуки', 'Ноутбуки');
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await screen.findByText(t('admin.sections.slugHint'), {
      selector: '[role="alert"]',
    });
    expect(insertSections).not.toHaveBeenCalled();
  });

  it('створення: insert з crypto id, parentId null, imageUrl з першого референсу', async () => {
    render(<SectionEditPage />, { wrapper });
    fill('Планшети', 'tablets');
    const up = screen.getByTestId('image-upload');
    expect(up.getAttribute('data-entity-type')).toBe('section');
    expect(up.getAttribute('data-max')).toBe('1');
    const newId = up.getAttribute('data-entity-id');
    expect(newId).toMatch(/^[0-9a-f-]{36}$/);
    fireEvent.click(screen.getByText('add-image'));
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const [{ data }] = insertSections.mock.calls[0] as [
      { data: Array<Record<string, unknown>> },
    ];
    expect(data[0]!.id).toBe(newId);
    expect(data[0]!.parentId).toBeNull();
    expect(data[0]!.imageUrl).toBe('section/n/new.jpg');
    expect(data[0]!.slug).toBe('tablets');
  });

  it('картинку прибрано → patch imageUrl: null', async () => {
    params.sectionId = ROWS[0]!.id;
    updateSections.mockImplementation(async () => [
      { ...ROWS[0]!, imageUrl: null },
    ]);
    render(<SectionEditPage />, { wrapper });
    await screen.findByDisplayValue('Ноутбуки');
    fireEvent.click(screen.getByText('clear-image'));
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));
    await waitFor(() => expect(updateSections).toHaveBeenCalled());
    const [{ data }] = updateSections.mock.calls[0] as [
      { data: Array<{ id: string; patch: Record<string, unknown> }> },
    ];
    expect(data[0]!.id).toBe(ROWS[0]!.id);
    expect(data[0]!.patch).toEqual({ imageUrl: null });
  });

  it('діалог видалення містить admin.sections.deleteWarning', async () => {
    params.sectionId = ROWS[0]!.id;
    render(<SectionEditPage />, { wrapper });
    await screen.findByDisplayValue('Ноутбуки');
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(t('admin.sections.deleteWarning')),
    ).toBeTruthy();
  });

  it('дубль slug → тост admin.errors.slugTaken, форма лишається з введеним', async () => {
    insertSections.mockRejectedValue(
      Object.assign(new Error('dup'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'sections_slug_key',
      }),
    );
    render(<SectionEditPage />, { wrapper });
    fill('Планшети', 'laptops');
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(t('admin.errors.slugTaken')),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Назва') as HTMLInputElement).value).toBe(
      'Планшети',
    );
    expect(
      (screen.getByLabelText(t('admin.common.slug')) as HTMLInputElement).value,
    ).toBe('laptops');
  });

  it('невідомий id: стан «не знайдено», форми й insert немає', async () => {
    params.sectionId = 'b0000000-0000-4000-8000-0000000000ff';
    render(<SectionEditPage />, { wrapper });
    await screen.findByText(t('admin.sections.notFound'));
    expect(screen.queryByLabelText('Назва')).toBeNull();
    expect(insertSections).not.toHaveBeenCalled();
  });

  it('панель призначень властивостей — лише для наявного розділу', async () => {
    render(<SectionEditPage />, { wrapper });
    await screen.findByLabelText('Назва');
    expect(screen.queryByTestId('assignments-panel')).toBeNull();
    cleanup();
    params.sectionId = ROWS[0]!.id;
    render(<SectionEditPage />, { wrapper });
    const panel = await screen.findByTestId('assignments-panel');
    expect(panel.getAttribute('data-section-id')).toBe(ROWS[0]!.id);
  });

  it('відмова видалення: без «не знайдено», несохранене введення лишається', async () => {
    params.sectionId = ROWS[0]!.id;
    let reject!: (e: unknown) => void;
    removeSections.mockReturnValue(
      new Promise((_, rej) => {
        reject = rej;
      }),
    );
    render(<SectionEditPage />, { wrapper });
    await screen.findByDisplayValue('Ноутбуки');
    fireEvent.change(screen.getByLabelText('Назва'), {
      target: { value: 'Ноутбуки змінені' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: t('common.delete') }),
    );
    await waitFor(() => expect(removeSections).toHaveBeenCalled());
    // Оптимістично рядка вже немає, але сторінка НЕ показує «не знайдено».
    expect(screen.queryByText(t('admin.sections.notFound'))).toBeNull();
    reject(new Error('boom'));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(`${t('common.error')} boom`),
    );
    // Повернений рядок не затирає введене (скидання — лише при першому надходженні).
    await screen.findByDisplayValue('Ноутбуки змінені');
    expect(screen.queryByText(t('admin.sections.notFound'))).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
