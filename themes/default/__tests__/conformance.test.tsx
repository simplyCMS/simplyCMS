// @vitest-environment jsdom
//
// Conformance-гейт контракту тем v3 для default-теми — ДРУГИЙ канал запуску
// (перший, канонічний: `pnpm simplycms theme:conformance default`).
//
// Що доводиться: кожен ЗАЯВЛЕНИЙ темою view (`views` в `index.ts`)
// (а) на повних даних розставляє всі обовʼязкові реквізити сторінки
// (маркери `data-simplycms-requisite`, склад — `REQUIRED_REQUISITES`) і
// (б) не падає на крайніх станах (товар без фото, порожня секція).
//
// 🔴 Роутер тут НЕ мокається, і це навмисно. Шаблон `create theme` радить
// мок `@tanstack/react-router`, бо kit роутера не піднімає, — але моку немає
// в канонічному CLI-каналі, який імпортує тему справжнім графом модулів.
// Тому лінк теми деградує до `<a>` сам (`views/parts/ViewLink.tsx`), і обидва
// канали проходять однаково. Мок повернув би тест до зеленого стану, якого
// CLI-канал не побачив би, — тобто зробив би цей файл слабшим за гейт.
// 🔴 Чому в `__tests__/`, а не в корені теми, як велить шаблон
// `simplycms create theme`: `tests/i18n-coverage.test.ts` монорепо сканує
// теку `themes/` цілком і пропускає лише теки `__tests__` — файл
// `themes/default/conformance.test.tsx` з українськими назвами тестів валив
// той гейт як «хардкоджені рядки інтерфейсу». Для магазину розкладка
// байдужа, для цього репозиторію — ні.
import { describe, it, expect } from 'vitest';
import { assertThemeViewsConformance } from '@simplycms/themes/conformance';
import theme from '../index';

describe('тема default: контракт v3', () => {
  it('заявлені views проходять conformance', async () => {
    const checked = await assertThemeViewsConformance(theme);

    // Порядок — як у `buildConformanceCases`: перевіряємо саме ФАКТИЧНО
    // прогнані сторінки, а не `Object.keys(theme.views)`.
    expect(checked).toEqual(['Catalog', 'CatalogSection', 'ProductDetail']);
  });
});
