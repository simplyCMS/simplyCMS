import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { BreadcrumbItem } from '@simplycms/objects/views';

/**
 * Хлібні крихти вітрини. Ланка без `href` — поточна сторінка: рендериться
 * текстом, не лінком.
 */
export function ProductDetailBreadcrumbs({
  items,
}: {
  items: BreadcrumbItem[];
}) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
      {items.map((item, index) => (
        <Fragment key={`${index}-${item.label}`}>
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          {item.href ? (
            <Link
              to={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
