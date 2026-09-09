import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { BreadcrumbItem, CatalogSlots } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { MONO_STACK } from '../../components/mono';
import { ViewBreadcrumbs } from '../parts/ViewBreadcrumbs';

interface CatalogShellProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  subtitle: string;
  productCount: number;
  slots: CatalogSlots;
}

/**
 * Спільний кістяк каталогу й розділу — та сама ідіома, що `CatalogLayout` в
 * ядрі: дві сторінки мають однакову структуру, дублювати її двічі нема сенсу.
 *
 * Розкладка знята з референсу (спека `views/Catalog.spec.md`): шапка 36px,
 * стрічка чипсів у білій pill-обгортці зі скролом по горизонталі, компактна
 * панель інструментів без роздільної лінії.
 *
 * 🔴 Сайдбар фільтрів лишається (у референсі фільтрів немає взагалі) —
 * свідоме рішення прогону №4: слот `Filters` несе власний вертикальний
 * лейаут із заголовком, а робочі фільтри магазину цінніші за вірність
 * референсу. Мобільний варіант — нативний `<details>`, а не Radix `Sheet`:
 * вміст лишається в DOM (важливо для conformance) і тема не тягне залежність.
 */
export function CatalogShell({
  breadcrumbs,
  title,
  subtitle,
  productCount,
  slots,
}: CatalogShellProps) {
  const t = useT();

  return (
    <>
      <ViewBreadcrumbs items={breadcrumbs} className="mb-4" />

      <header className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <div className="mb-4 w-full rounded-full bg-card px-2 py-1.5 md:w-fit">
        <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Реквізит: чипси розділів (власний `mb-6` слота знімаємо) */}
          <slots.SectionChips className="mb-0 flex-nowrap gap-2" />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className="truncate text-sm text-muted-foreground"
          style={{ fontFamily: MONO_STACK }}
        >
          {t('catalog.productsCount', { count: productCount })}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {/* Реквізити: сортування і перемикач вигляду */}
          <slots.SortSelect />
          <slots.ViewModeToggle />
        </div>
      </div>

      <details className="group mb-4 lg:hidden">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-in-out hover:text-foreground [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="h-4 w-4" />
          {t('catalog.filters')}
          <ChevronDown className="h-4 w-4 transition-transform duration-200 ease-in-out group-open:rotate-180" />
        </summary>
        <div className="mt-3 rounded-lg bg-card p-5">
          {/* Реквізит: фільтри (мобільний варіант) */}
          <slots.Filters />
        </div>
      </details>

      {/* Реквізит: бейджі активних фільтрів (корінь `contents`) */}
      <slots.ActiveFilters />

      <div className="flex gap-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 rounded-lg bg-card p-5">
            {/* Реквізит: фільтри (десктоп) */}
            <slots.Filters />
          </div>
        </aside>

        {/* 🔴 min-w-0: без нього flex-item не стискається менше за вміст і
            панель інструментів дає горизонтальний скрол на 390px. */}
        <div className="min-w-0 flex-1">
          {/* Реквізит: сітка товарів з усіма станами */}
          <slots.ProductGrid />
        </div>
      </div>
    </>
  );
}
