// `@simplycms/themes/conformance` — публічний conformance-kit контракту тем
// v3 (спека §7).
//
// 🔴 Субшлях, а НЕ барель: `@simplycms/themes` тягне `getActiveThemeSSR` →
// anon-клієнт Supabase, і імпорт kit-а з барелю затягнув би серверний вантаж
// туди, де його бути не має (та сама ідіома, що в `safeFontStylesheets`).

export {
  assertThemeViewsConformance,
  type ThemeViewsConformanceOptions,
} from './assertThemeViewsConformance';
export { CONFORMANCE_STATES, type ConformanceState } from './cases';
