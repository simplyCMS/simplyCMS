import { safeFontStylesheets } from '@simplycms/themes/safeFontStylesheets';

/**
 * Зовнішні font stylesheet-и активної теми у вигляді `<link>`-тегів.
 *
 * Контракт v2.2 (Р4/Р5): тема може оголосити `fonts` — масив `https:`-URL
 * зовнішніх stylesheet-ів (напр. Google Fonts). Компонент рендериться в
 * ОБОХ каркасах поруч із `ThemeTokens`. `<link>` у body — валідно, React 19
 * не видає precedence-попередження (перевірено адверсаріальним ревʼю).
 *
 * 🔴 Імпорт ТІЛЬКИ субшляхом (Р11): barrel `@simplycms/themes` тягне
 * `getActiveThemeSSR` → `@simplycms/supabase/anon-client`, і його імпорт
 * з цього клієнтського компонента затягнув би серверний код у бандл.
 */
export function ThemeFonts({
  fonts,
}: {
  fonts?: ReadonlyArray<{ stylesheet: string }>;
}) {
  const stylesheets = safeFontStylesheets(fonts);
  if (stylesheets.length === 0) return null;

  return (
    <>
      {stylesheets.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}
