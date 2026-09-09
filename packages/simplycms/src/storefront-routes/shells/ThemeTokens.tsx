import { applyTokens } from 'simplycms/themes/applyTokens';
import type { DesignTokens } from 'simplycms/themes/types';

/**
 * Токени активної теми у вигляді інлайн-`<style>`.
 *
 * Замінює тематичний CSS-клас на `<html>` (як робив старий `MainLayout`):
 * тема більше не постачає власний CSS-файл — лише значення для НАЯВНИХ
 * semantic-змінних shadcn. Стиль нешаровий, тож перекриває `@layer base`
 * з `globals.css` незалежно від порядку завантаження.
 */
export function ThemeTokens({ tokens }: { tokens: DesignTokens }) {
  const css = applyTokens(tokens);
  if (!css) return null;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
