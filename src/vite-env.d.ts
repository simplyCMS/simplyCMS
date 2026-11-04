/// <reference types="vite/client" />

// 🔴 Клієнтський контракт env магазину — рівно один ключ. Серверні
// (`DATABASE_URL`, `BETTER_AUTH_SECRET`) сюди не входять за побудовою: вони
// читаються з `process.env` у рантаймі й у бандл не потрапляють ніколи.
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
