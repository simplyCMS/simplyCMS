// @vitest-environment jsdom
//
// Conformance-гейт контракту тем v3 для теми «__THEME_DISPLAY_NAME__».
//
// 🔴 Цей файл — ДРУГИЙ канал запуску гейта, для магазинів і CI, де рушій
// тестів уже є. КАНОНІЧНИЙ канал працює завжди й без рушія:
//
//   pnpm simplycms theme:conformance __THEME_NAME__
//
// Магазин без vitest цей файл просто ігнорує — це не блокер.
//
// Що доводиться: кожен ЗАЯВЛЕНИЙ темою view (`views` у `index.ts`)
// (а) на повних даних розставляє всі обовʼязкові реквізити сторінки
// (маркери `data-simplycms-requisite`) і (б) не падає на крайніх станах
// (товар без фото, порожній кошик, порожня секція). Тема без `views` —
// чесний pass: перевіряти нічого.
//
// Якщо view теми використовує `Link` із `@tanstack/react-router`, kit роутера
// НЕ піднімає (він перевіряє тему, а не навігацію) — замокай модуль:
//
//   vi.mock('@tanstack/react-router', () => ({
//     Link: ({ children }: { children?: ReactNode }) => children,
//   }));
//
// 🔴 Мок навмисно БЕЗ JSX: цей файл — `.ts`, і `<a>{children}</a>` у ньому не
// зібрався б. Потрібна саме розмітка — перейменуй файл на `.tsx`.
import { describe, it } from 'vitest';
import { assertThemeViewsConformance } from '@simplycms/themes/conformance';
import theme from './index';

describe('тема __THEME_NAME__: контракт v3', () => {
  it('заявлені views проходять conformance', async () => {
    await assertThemeViewsConformance(theme);
  });
});
