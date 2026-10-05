import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapUnderline from '@tiptap/extension-underline';

/**
 * Набір розширень Tiptap редактора відгуків — ЄДИНЕ джерело для
 * `ReviewRichTextEditor` і для round-trip тесту санітизатора
 * (`simplycms/sanitize`, профіль `review`): білий список тегів і класів
 * санітизатора мусить збігатися з тим, що ці розширення віддають у `getHTML()`.
 */
export function reviewEditorExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
    }),
    TiptapUnderline,
    TiptapLink.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary underline cursor-pointer',
      },
    }),
  ];
}
