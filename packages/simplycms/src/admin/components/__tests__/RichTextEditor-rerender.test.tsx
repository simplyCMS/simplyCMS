// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { RichTextEditor } from '../RichTextEditor';

afterEach(cleanup);

interface TiptapLike {
  commands: { insertContent: (c: string) => boolean; undo: () => boolean };
  getHTML: () => string;
}

/**
 * Задача 14в: `t` додано в залежності `setLink`/`addImage`. `useEditor`
 * отримує опції без `t`, тож ре-рендер батька не повинен перестворювати
 * редактор: набраний вміст і історія undo переживають його.
 */
describe('RichTextEditor: ре-рендер батька', () => {
  it('вміст і історія undo зберігаються (редактор не перестворюється)', async () => {
    let bump: () => void = () => {};
    function Parent() {
      const [n, setN] = useState(0);
      bump = () => setN((x) => x + 1);
      return (
        <I18nProvider locale="uk">
          <span data-testid="n">{n}</span>
          <RichTextEditor content="<p>start</p>" onChange={() => {}} />
        </I18nProvider>
      );
    }
    const { container } = render(<Parent />);
    await screen.findByRole('textbox');
    const dom = container.querySelector('.ProseMirror')!;
    // Tiptap кладе інстанс на DOM-вузол редактора.
    const editor = (dom as unknown as { editor: TiptapLike }).editor;

    act(() => {
      editor.commands.insertContent('abc');
    });
    expect(editor.getHTML()).toContain('abc');

    act(() => bump());
    act(() => bump());

    expect(screen.getByTestId('n').textContent).toBe('2');
    // Той самий вузол і той самий інстанс: редактор не перестворено.
    expect(container.querySelector('.ProseMirror')).toBe(dom);
    expect((dom as unknown as { editor: TiptapLike }).editor).toBe(editor);
    expect(editor.getHTML()).toContain('abc');
    // Історія undo пережила ре-рендер.
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getHTML()).not.toContain('abc');
  });
});
