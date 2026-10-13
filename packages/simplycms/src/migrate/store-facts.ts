import { withRuntimeAdminRead, type RuntimeReadOptions } from './runtime-read';

/** Факти про наповнення магазину, потрібні `status` і `doctor --online`. */
export type StoreFacts = {
  /** Користувачі з роллю `admin` (`user_roles`). */
  owners: number;
  /** Назва й email профілю магазину; `null` — рядка профілю немає. */
  profile: { name: string; email: string | null } | null;
  /** Листи в outbox, які вже пробували надіслати й не доставили (`attempts > 0`). */
  failedMail: number;
};

// Профіль читається сирим jsonb-ом, а не через `simplycms/domain/store-profile`:
// CLI-канал `migrate` не тягне доменний шар, а потрібні лише два поля.
const FACTS_SQL = `select
  (select count(*)::int from public.user_roles where role = 'admin') as owners,
  (select value from public.system_settings where key = 'store_profile') as profile,
  (select count(*)::int from public.mail_outbox where attempts > 0) as failed_mail`;

type Row = { owners: number; profile: unknown; failed_mail: number };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

function toProfile(raw: unknown): StoreFacts['profile'] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return raw === null || raw === undefined ? null : { name: '', email: null };
  const { name, contacts } = raw as { name?: unknown; contacts?: unknown };
  const email =
    contacts !== null && typeof contacts === 'object'
      ? text((contacts as { email?: unknown }).email)
      : null;
  return { name: text(name) ?? '', email };
}

/**
 * Факти про магазин з рантайм-підключення (`DATABASE_URL`) — той самий канал,
 * що й `readJournal` (`withRuntimeAdminRead`). Модуль `simplycms/mail` CLI не
 * імпортує: він тягне пул `simplycms/db` з `process.env`, а CLI env процесу не мутує.
 */
export async function readStoreFacts(
  runtimeConnectionString: string,
  options: RuntimeReadOptions = {},
): Promise<StoreFacts> {
  const row = await withRuntimeAdminRead(
    runtimeConnectionString,
    options,
    async (client) => (await client.query<Row>(FACTS_SQL)).rows[0]!,
  );
  return {
    owners: row.owners,
    profile: toProfile(row.profile),
    failedMail: row.failed_mail,
  };
}
