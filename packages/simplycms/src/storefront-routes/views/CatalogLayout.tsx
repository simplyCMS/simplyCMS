import type { CatalogSlots } from 'simplycms/contracts/views';
import { CatalogToolbar } from './CatalogToolbar';

/** Заголовок сторінки вибірки: назва й підпис. */
export function CatalogPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-4xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/**
 * Тіло сторінки вибірки — спільне для каталогу й розділу: чипси розділів,
 * сайдбар фільтрів, панель інструментів, бейджі активних фільтрів і сітка.
 * Розходяться сторінки лише «шапкою» й описом розділу, тому дублювати цей
 * кістяк у двох канонічних view нема потреби.
 */
export function CatalogLayout({
  productCount,
  slots,
}: {
  productCount: number;
  slots: CatalogSlots;
}) {
  return (
    <>
      {/* Реквізит: чипси розділів */}
      <slots.SectionChips />

      <div className="flex gap-8">
        <aside className="hidden lg:block w-64 flex-shrink-0">
          {/* Реквізит: фільтри (десктоп) */}
          <slots.Filters />
        </aside>

        {/* 🔴 min-w-0: без нього flex-item має min-width:auto й не стискається
            менше за вміст — панель інструментів (фільтр + лічильник +
            селект сортування w-[180px]) розпирала контейнер і давала
            горизонтальний скрол сторінки на 390px. Спіймано e2e. */}
        <div className="min-w-0 flex-1">
          <CatalogToolbar productCount={productCount} slots={slots} />

          {/* Реквізит: бейджі активних фільтрів */}
          <slots.ActiveFilters />

          {/* Реквізит: сітка товарів з усіма станами (SSR → клієнт) */}
          <slots.ProductGrid />
        </div>
      </div>
    </>
  );
}
