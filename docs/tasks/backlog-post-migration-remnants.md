# Backlog: живі залишки після міграції та чисток

> Створено 2026-07-30 під час розчищення `docs/tasks/`. Сюди перенесені
> **досі актуальні** вимоги з видалених застарілих документів
> (`post-migration-code-smells-cleanup.md`, `ssr-product-list-enrichment.md`,
> known follow-ups з `migration-execution-workflow.md`). Кожен пункт
> самодостатній — оригінальні документи видалені (доступні в git history).

## 🔴 Деплой

- [ ] **Server preset / `pnpm start` не працює.** `vite build` емітить
      `dist/client` + `dist/server`, але не самостійний node-сервер;
      `pnpm start` очікує `.output/server/index.mjs`, якого не існує.
      Обрати server target (node-server / vercel / інший хостинг) і полагодити
      production-запуск. Повʼязано з
      [`production-seo-routes-tanstack-start.md`](./production-seo-routes-tanstack-start.md)
      (custom server entry — природне місце для обох задач).

## 🟠 Безпека

- [ ] **Guest-order token у URL.** `order-success/$orderId?token=...` —
      одноразовий `access_token` лишається в історії браузера/referrer.
      Після успішного завантаження замовлення прибирати `token` з URL
      (router replace без reload), не змінюючи контракт Edge Function
      `get-guest-order`. Код: `packages/simplycms/core/src/pages/OrderSuccess.tsx`,
      `src/routes/_storefront/order-success/$orderId.tsx`.

## 🟡 Плагін-система (розірваний контур)

- [ ] **Wiring відсутній:** `registerPluginModule()` і `loadPlugins()`
      (`packages/simplycms/plugin-system/src/PluginLoader.ts`) ніде не
      викликаються — всі `PluginSlot`-и рендерять порожньо, директорія
      `plugins/` порожня. Механізм підключення проєктується в архітектурі
      платформи (design doc) — після затвердження зʼєднати контур або
      свідомо переробити.
- [ ] **Шумне логування:** 3 × `console.log` у `PluginLoader.ts` на штатні
      події — прибрати або сховати за debug-прапор (у `ThemeRegistry`
      вже лише `console.error`).

## 🟡 SSR-повнота storefront

- [ ] **Перевірити SSR списків товарів.** Історична проблема: клієнтський
      enrichment-pipeline (модифікації → ціни → доступність) не збігався
      з серверними даними, і картки товарів не потрапляли в серверний HTML.
      Перевірити поточний стан на TanStack Start (`curl` сторінок
      `/catalog`, `/catalog/$sectionSlug`: чи є в HTML назви/ціни товарів);
      якщо ні — винести enrichment на сервер (одне джерело правди,
      без дублювання логіки).

## ℹ️ Контекст

Актуальні відкриті продуктові задачі — окремо:
- [`seo-ssr-faceted-navigation.md`](./seo-ssr-faceted-navigation.md) — SEO/фільтри (велика)
- [`production-seo-routes-tanstack-start.md`](./production-seo-routes-tanstack-start.md) — sitemap/robots у production
- [`core-engine-extraction-implementation.md`](./core-engine-extraction-implementation.md) — модульність ядра (триває)
