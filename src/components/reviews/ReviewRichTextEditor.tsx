import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect } from "react";

interface ReviewRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function ReviewRichTextEditor({
  content,
  onChange,
  placeholder = "Напишіть ваш відгук...",
  className,
}: ReviewRichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[120px] p-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL посилання", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50">
        <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Toggle size="sm" pressed={editor.isActive("link")} onPressedChange={setLink}>
          <LinkIcon className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
