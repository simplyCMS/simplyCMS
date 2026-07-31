// Перенесено в @simplycms/catalog-ui. Re-export для зворотної сумісності.
// 🔴 Тільки ІМЕНОВАНІ re-export-и: `export * from '<external>'` esbuild при
// splitting лишає у спільному чанку й НЕ піднімає в entry — опублікований
// пакет виходив без експортів (знахідка пілота Task 3.1).
export { FilterSidebar } from '@simplycms/catalog-ui/FilterSidebar';
export type { FilterValue } from '@simplycms/catalog-ui/FilterSidebar';
