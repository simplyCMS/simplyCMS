import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';

/**
 * Набір розширень Tiptap редактора адмінки — ЄДИНЕ джерело для
 * `RichTextEditor` і для round-trip тесту санітизатора
 * (`simplycms/sanitize`, профіль `content`): білий список тегів, класів і
 * `style` санітизатора мусить збігатися з тим, що ці розширення віддають.
 */
export function contentEditorExtensions() {
  return [
    // StarterKit v3 уже містить link + underline — налаштовуємо link тут,
    // щоб не дублювати розширення (underline лишаємо з типовою конфігурацією).
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded-lg',
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
  ];
}
