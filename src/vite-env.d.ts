/// <reference types="vite/client" />

// 🔴 Клієнтський контракт env магазину — рівно один ключ. Серверні
// (`DATABASE_URL`, `BETTER_AUTH_SECRET`) сюди не входять за побудовою: вони
// читаються з `process.env` у рантаймі й у бандл не потрапляють ніколи.
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  /** Локаль прогону — задається лише тулінгом, у продукті береться з конфіга. */
  readonly VITE_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
