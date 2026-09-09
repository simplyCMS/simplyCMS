// 🔴 Кореневий тест, не в пакеті ядра: він імпортує HOST-файл
// (`src/router.tsx`), а пакет `simplycms` у host лізти не повинен —
// це зворотний напрям залежності. Прецедент — `tests/admin-guard-path.test.ts`.
//
// Доводить топологію (не лише контракт CMSProvider): QueryClient
// народжується в getRouter() і кладеться в router context — саме там,
// де до нього дотягнеться `loader` роуту (Е1б), поза React-деревом.
import { describe, expect, it } from 'vitest';
import { getRouter } from '../src/router';

describe('топологія: клієнт роутера — той самий, що в дереві', () => {
  it('router.options.context.queryClient існує', () => {
    const router = getRouter();
    // 🔴 Без цього `loader` не має де взяти колекцію (Е1б).
    expect(router.options.context?.queryClient).toBeDefined();
  });

  it('два виклики getRouter дають РІЗНІ клієнти', () => {
    // Кожен запит на сервері має власний кеш: спільний інстанс протік би
    // між користувачами.
    expect(getRouter().options.context.queryClient).not.toBe(
      getRouter().options.context.queryClient,
    );
  });
});
