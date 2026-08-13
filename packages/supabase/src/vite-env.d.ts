/// <reference types="vite/client" />

// Клієнтський контур пакета (`browser-client.ts`) читає `import.meta.env`
// напряму, тому пакет сам оголошує свій контракт оточення — інакше
// standalone-збірка (tsup поза host-програмою) не має звідки взяти ці ключі.
// Серверні фабрики (`server-client.ts`, `anon-client.ts`) читають `process.env`
// у рантаймі (контракт серверного env). Оголошення дослівно збігаються з host-овим
// `src/vite-env.d.ts`: TS зливає однойменні інтерфейси лише за ідентичних
// членів, і будь-яке розходження впаде на `pnpm typecheck`.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Новий нейминг публічного ключа Supabase (має пріоритет). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy-нейминг публічного ключа — fallback для наявних інсталяцій. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
