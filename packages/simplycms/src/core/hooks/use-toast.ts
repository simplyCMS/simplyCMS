// Перенесено в simplycms/ui. Re-export для зворотної сумісності.
// 🔴 Тільки ІМЕНОВАНІ re-export-и: `export * from '<external>'` esbuild при
// splitting лишає у спільному чанку й НЕ піднімає в entry — опублікований
// пакет виходив без експортів (знахідка пілота Task 3.1).
export { useToast, toast, reducer } from 'simplycms/ui/use-toast';
export type { ToastVariant, ToastProps } from 'simplycms/ui/use-toast';
