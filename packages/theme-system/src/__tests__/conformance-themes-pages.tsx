// Синтетичні view решти трьох сторінок для негативного контролю kit-а (Р8).
//
// 🔴 Окремий файл від `conformance-themes.tsx` не з міркувань чистоти, а
// через ліміт розміру: набір слотів каталогу вшестеро більший за кошиковий.
// Пара «валідний / з дефектом» тут та сама, що й там: kit має вміти
// червоніти на кожній із пʼяти сторінок, інакше блок у `cases.tsx` можна
// мовчки прибрати.

import type {
  CatalogSectionViewModel,
  CatalogSlots,
  CatalogViewModel,
  HomeViewModel,
} from '@simplycms/objects/views';

/**
 * Спільне тіло каталогу: обидві сторінки мають однаковий набір слотів, тому
 * дефект «загублена сітка товарів» вноситься одним прапорцем.
 */
function CatalogBody({
  slots,
  withGrid,
}: {
  slots: CatalogSlots;
  withGrid: boolean;
}) {
  return (
    <div>
      <slots.SectionChips />
      <slots.Filters />
      <slots.SortSelect />
      <slots.ViewModeToggle />
      <slots.ActiveFilters />
      {withGrid ? <slots.ProductGrid /> : null}
    </div>
  );
}

/** Валідна головна: карусель на кожну кореневу секцію (0..N разів). */
export function GoodHome({ sections, slots }: HomeViewModel) {
  return (
    <div>
      {sections.items.map((section) => (
        <slots.SectionCarousel key={section.id} sectionId={section.id} />
      ))}
    </div>
  );
}

/**
 * Дефект №3: головна падає на магазині без кореневих категорій.
 *
 * 🔴 Саме падіння, а не загублений реквізит: `REQUIRED_REQUISITES.Home`
 * порожній за спекою §5 (`SectionCarousel` рендериться 0..N разів), тож
 * єдиний дефект головної, який гейт узагалі здатен спіймати, — крайній стан.
 */
export function HomeCrashingWithoutSections({
  sections,
  slots,
}: HomeViewModel) {
  if (sections.items.length === 0) {
    throw new Error('home view: не передбачено магазин без категорій');
  }

  return (
    <div>
      {sections.items.map((section) => (
        <slots.SectionCarousel key={section.id} sectionId={section.id} />
      ))}
    </div>
  );
}

/** Валідний каталог: розставлені всі шість реквізитів. */
export function GoodCatalog({ slots }: CatalogViewModel) {
  return <CatalogBody slots={slots} withGrid />;
}

/** Дефект №4: каталог без сітки товарів — вибірку не видно. */
export function CatalogWithoutProductGrid({ slots }: CatalogViewModel) {
  return <CatalogBody slots={slots} withGrid={false} />;
}

/** Валідна сторінка розділу: ті самі шість реквізитів + назва розділу. */
export function GoodCatalogSection({
  section,
  slots,
}: CatalogSectionViewModel) {
  return (
    <section aria-label={section.name}>
      <CatalogBody slots={slots} withGrid />
    </section>
  );
}

/** Дефект №5: сторінка розділу без сітки товарів. */
export function CatalogSectionWithoutProductGrid({
  slots,
}: CatalogSectionViewModel) {
  return <CatalogBody slots={slots} withGrid={false} />;
}
