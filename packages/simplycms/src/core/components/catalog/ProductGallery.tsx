// Перенесено в simplycms/catalog-ui. Re-export для зворотної сумісності.
// 🔴 Тільки ІМЕНОВАНІ re-export-и: `export * from '<external>'` esbuild при
// splitting лишає у спільному чанку й НЕ піднімає в entry — опублікований
// пакет виходив без експортів (знахідка пілота).
export { ProductGallery } from 'simplycms/catalog-ui/ProductGallery';
