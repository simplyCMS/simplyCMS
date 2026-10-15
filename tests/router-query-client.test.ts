// 🔴 Кореневий тест, не в пакеті ядра: він імпортує HOST-файл
// (`src/router.tsx`), а пакет `simplycms` у host лізти не повинен —
// це зворотний напрям залежності. Прецедент — `tests/admin-guard-path.test.ts`.
//
// Доводить топологію (не лише контракт CMSProvider): QueryClient
// народжується в getRouter() і кладеться в router context — саме там,
// де до нього дотягнеться `loader` роуту (Е1б), поза React-деревом.
import { describe, expect, it } from 'vitest';
import { withRequestContext } from 'simplycms/site/request-context';
import { getRouter as getRouterInRequest } from '../src/router';

// `getRouter()` читає набір мов із контексту запиту (його виставляє серверний
// вхід), тож тест народжує роутер у запиті, як це робить Start.
async function getRouter() {
  let router!: ReturnType<typeof getRouterInRequest>;
  await withRequestContext(async () => {
    const { getRequestContext } =
      await import('simplycms/site/request-context');
    getRequestContext()!.storefront = {
      locales: { primary: 'uk', published: ['uk'], known: ['uk'] },
    };
    router = getRouterInRequest();
    return new Response('ok');
  })(new Request('http://localhost/'));
  return router;
}

describe('топологія: клієнт роутера — той самий, що в дереві', () => {
  it('router.options.context.queryClient існує', async () => {
    const router = await getRouter();
    // 🔴 Без цього `loader` не має де взяти колекцію (Е1б).
    expect(router.options.context?.queryClient).toBeDefined();
  });

  it('два виклики getRouter дають РІЗНІ клієнти', async () => {
    // Кожен запит на сервері має власний кеш: спільний інстанс протік би
    // між користувачами.
    expect((await getRouter()).options.context.queryClient).not.toBe(
      (await getRouter()).options.context.queryClient,
    );
  });

  it('мовний контекст: набір мов у context.locales і rewrite префіксів', async () => {
    const router = await getRouter();
    // Без цього `/en/x` не розібрався б у роутері, а посилання не отримали б префікс.
    expect(router.options.context.locales).toEqual({
      primary: 'uk',
      published: ['uk'],
      known: ['uk'],
    });
    expect(router.options.rewrite?.input).toBeTypeOf('function');
    expect(router.options.rewrite?.output).toBeTypeOf('function');
  });
});
