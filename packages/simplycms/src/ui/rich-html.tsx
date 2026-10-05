import type { SanitizedHtml } from 'simplycms/contracts';

/** Теги-обгортки, які дозволено `as` (контейнер блоку розмітки). */
type RichHtmlTag = 'div' | 'section' | 'article' | 'span';

interface RichHtmlProps {
  /** Лише результат `sanitizeRichHtml` — сирий `string` компілятор відхилить. */
  html: SanitizedHtml;
  className?: string;
  as?: RichHtmlTag;
}

/**
 * ЄДИНЕ місце в репо, де розмітку контенту (відгуки, описи розділів, опцій,
 * товарів) вставляють у DOM через `dangerouslySetInnerHTML`.
 *
 * 🔴 Безпеку тримає ТИП, а не цей компонент: `html` приймає лише
 * `SanitizedHtml` (брендований тип T0), а створює його тільки серверний
 * `sanitizeRichHtml` (`simplycms/sanitize`). Правило ESLint
 * `simplycms-rich-html/no-dangerously-set-inner-html` забороняє
 * `dangerouslySetInnerHTML` деінде (крім явного списку винятків із причинами).
 * Теми рендерять розмітку контенту ЛИШЕ через цей компонент.
 */
export function RichHtml({ html, className, as: Tag = 'div' }: RichHtmlProps) {
  return (
    <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
