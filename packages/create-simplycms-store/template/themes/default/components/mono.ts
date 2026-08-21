/**
 * Моноширинний стек теми — акцентна гарнітура даних (моно-мітки секцій,
 * заголовки колонок футера, бейдж героя).
 *
 * 🔴 Чому літералом, а не токеном: контракт `ThemeTokenValues` свідомо не
 * має `font-mono` (YAGNI у `packages/simplycms/src/themes/types.ts`), тож
 * `applyTokens` таку змінну не розкладе. Тримати стек в одному місці все
 * одно треба — інакше він розповзеться копіями по трьох компонентах.
 *
 * Сам шрифт приїжджає тим самим Google-Fonts-stylesheet-ом, що й `Geist`
 * (`ThemeModule.fonts` у `themes/default/index.ts`).
 */
export const MONO_STACK = "'Geist Mono', ui-monospace, monospace";

/**
 * Спільний клас моно-мітки: 12px, uppercase, розріджений трекінг.
 * Гарнітура — інлайновим `style`, бо Tailwind-класу під неї немає.
 */
export const MONO_LABEL = 'text-xs font-medium uppercase tracking-[0.1em]';
