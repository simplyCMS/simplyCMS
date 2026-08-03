/// <reference types="vite/client" />

// Пакет читає `import.meta.env` напряму, тому сам оголошує свій контракт
// оточення — інакше standalone-збірка (tsup поза host-програмою) не має
// звідки взяти ці ключі. Оголошення дослівно збігаються з host-овим
// `src/vite-env.d.ts`: TS зливає однойменні інтерфейси лише за ідентичних
// членів, і будь-яке розходження впаде на `pnpm typecheck`.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Новий нейминг публічного ключа Supabase (має пріоритет). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy-нейминг публічного ключа — fallback для наявних інсталяцій. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
