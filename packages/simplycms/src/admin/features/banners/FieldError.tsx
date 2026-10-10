/** Текст помилки під полем (`role="alert"`); без тексту нічого не рендерить. */
export function FieldError({ text }: { readonly text?: string }) {
  return text ? (
    <p role="alert" className="text-xs text-destructive">
      {text}
    </p>
  ) : null;
}
