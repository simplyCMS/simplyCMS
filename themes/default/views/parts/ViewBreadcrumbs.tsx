import { Fragment } from 'react';
import type { BreadcrumbItem } from 'simplycms/contracts/views';
import { MONO_STACK } from '../../components/mono';
import { ViewLink } from './ViewLink';

/**
 * Крихти view-шару теми.
 *
 * Вимір референсу (картка товару): ряд `14px`, `gap 6px`, роздільник «/»
 * кольору `gray-400`, поточна сторінка — `font-medium` чорнилом, гарнітура
 * моно (референс уживає моно для всіх службових міток). Ланка без `href` —
 * поточна сторінка: рендериться текстом, не лінком (контракт `BreadcrumbItem`).
 */
export function ViewBreadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      className={`flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground ${className ?? ''}`}
      style={{ fontFamily: MONO_STACK }}
    >
      {items.map((item, index) => (
        <Fragment key={`${index}-${item.label}`}>
          {index > 0 && <span className="text-border">/</span>}
          {item.href ? (
            <ViewLink
              to={item.href}
              className="transition-colors duration-150 ease-in-out hover:text-foreground"
            >
              {item.label}
            </ViewLink>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
