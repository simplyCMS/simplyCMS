/// <reference types="vite/client" />

// `import.meta.env.VITE_SITE_URL` читає ізоморфний роут товару
// (`packages/simplycms/routes/storefront/_storefront/catalog/**` —
// клієнтський контур, значення потрібне в бандлі); SEO-генератори
// (сусідня тека `seo/`) — серверний контур і читають `process.env` у
// рантаймі (контракт серверного env, спека CLI v1 §7).
// TS зливає однойменні інтерфейси лише за ідентичних членів, тож оголошення
// дослівно збігається з host-овим `src/vite-env.d.ts` (де додатково є
// `VITE_LOCALE`, потрібний лише хосту).
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
}
