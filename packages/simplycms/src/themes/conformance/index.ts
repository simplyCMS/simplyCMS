// `simplycms/themes/conformance` — публічний conformance-kit контракту тем
// v3 (спека §7).
//
// 🔴 Субшлях, а НЕ барель: `simplycms/themes` тягне `bootstrapThemes` →
// `simplycms/themes/server`, і імпорт kit-а з барелю затягнув би серверний
// вантаж туди, де його бути не має (ідіома `safeFontStylesheets`). Kit
// працює БЕЗ БД за визначенням — на фікстурах.

export {
  assertThemeViewsConformance,
  type ThemeViewsConformanceOptions,
} from './assertThemeViewsConformance';
export { CONFORMANCE_STATES, type ConformanceState } from './cases';
