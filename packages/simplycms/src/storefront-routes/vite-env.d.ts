/// <reference types="vite/client" />

// `import.meta.env.VITE_SITE_URL` читають ізоморфні роути вітрини
// (`packages/simplycms/routes/storefront/**` — клієнтський контур,
// значення потрібне в бандлі); SEO-генератори
// (сусідня тека `seo/`) — серверний контур і читають `process.env` у
// рантаймі (контракт серверного env, спека CLI v1 §7).
// TS зливає однойменні інтерфейси; члени можуть різнитись, але однойменні
// поля мусять мати однаковий тип, тож оголошення дослівно збігається з host-овим `src/vite-env.d.ts` (де додатково є
// `VITE_LOCALE`, потрібний лише хосту).
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
}
