/**
 * Резолвер груп env драйверів (К3-Е8, Е8-Р7). Чиста функція: нічого не читає з
 * `process.env` і не друкує — оточення приходить аргументом, попередження
 * повертаються даними, друкує викликач (старт магазину, doctor, status).
 *
 * 🔴 Правило «все або нічого»: група драйвера (S3, SMTP) або задана ПОВНІСТЮ,
 * або не задана зовсім. Часткова група — помилка старту, а не мовчазний
 * фолбек: забутий `S3_REGION` у Dokploy інакше тихо повернув би `local-fs`, і
 * файли пішли б у контейнер, що зникне з редеплоєм.
 */

/** Ключі групи S3-драйвера сховища. */
export const S3_KEYS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
] as const;

/** Ключі групи SMTP-драйвера пошти. */
export const SMTP_KEYS = ['SMTP_URL', 'MAIL_FROM'] as const;

export type MediaEnv =
  | { driver: 'local-fs'; root: string | null }
  | {
      driver: 's3';
      endpoint: string;
      region: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
    };

export type MailEnv =
  { driver: 'log' } | { driver: 'smtp'; url: string; from: string };

export type DriverEnv = {
  media: MediaEnv;
  mail: MailEnv;
  /** Друкує викликач: функція чиста й не має каналу виводу. */
  warnings: readonly string[];
};

/**
 * Часткова група. `missing` — імена відсутніх ключів, ніколи не значення:
 * повідомлення потрапляє в лог контейнера, а там не місце секретам.
 */
export class DriverEnvError extends Error {
  readonly group: 's3' | 'smtp';
  readonly missing: readonly string[];

  constructor(group: 's3' | 'smtp', missing: readonly string[]) {
    super(
      `[simplycms/env] Група ${group.toUpperCase()} задана не повністю: ` +
        `бракує ${missing.join(', ')}. Задай усі ключі групи або жодного.`,
    );
    this.name = 'DriverEnvError';
    this.group = group;
    this.missing = missing;
  }
}

type Env = Readonly<Record<string, string | undefined>>;

/** Dokploy зберігає порожній `KEY=` — для драйвера це «не задано». */
function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/**
 * Ключ env → поле конфігу драйвера. Єдине місце відповідності: з нього ж
 * читається група, тож додати ключ до `S3_KEYS` без поля не дасть тип.
 */
const S3_FIELD = {
  S3_ENDPOINT: 'endpoint',
  S3_REGION: 'region',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY: 'accessKey',
  S3_SECRET_KEY: 'secretKey',
} as const satisfies Record<(typeof S3_KEYS)[number], string>;

const SMTP_FIELD = {
  SMTP_URL: 'url',
  MAIL_FROM: 'from',
} as const satisfies Record<(typeof SMTP_KEYS)[number], string>;

/** Поля групи за відповідністю ключ → поле; `null` — група не задана зовсім. */
function readGroup<F extends Record<string, string>>(
  env: Env,
  fields: F,
  group: 's3' | 'smtp',
): { [K in F[keyof F]]: string } | null {
  const entries = Object.entries(fields).map(
    ([key, field]) => [key, field, read(env, key)] as const,
  );
  const missing = entries.filter(([, , v]) => v === undefined).map(([k]) => k);
  if (missing.length === entries.length) return null;
  if (missing.length > 0) throw new DriverEnvError(group, missing);
  return Object.fromEntries(entries.map(([, field, v]) => [field, v])) as {
    [K in F[keyof F]]: string;
  };
}

export function resolveDriverEnv(env: Env): DriverEnv {
  const warnings: string[] = [];
  const mediaRoot = read(env, 'MEDIA_ROOT');

  const s3 = readGroup(env, S3_FIELD, 's3');
  let media: MediaEnv;
  if (s3) {
    media = { driver: 's3', ...s3, endpoint: s3.endpoint.replace(/\/+$/, '') };
    // Е8-Б2: діючий драйвер один; ключ іншого не мовчки ігнорується.
    if (mediaRoot) {
      warnings.push(
        'MEDIA_ROOT проігноровано: активний драйвер s3 (задано всі S3_*).',
      );
    }
  } else {
    media = { driver: 'local-fs', root: mediaRoot ?? null };
  }

  const smtp = readGroup(env, SMTP_FIELD, 'smtp');
  const mail: MailEnv = smtp ? { driver: 'smtp', ...smtp } : { driver: 'log' };

  return { media, mail, warnings };
}

/**
 * Один рядок для логу старту й `status`. Без секретів: `SMTP_URL` несе пароль,
 * тож про SMTP повідомляється лише адреса відправника.
 */
export function describeDriverEnv(d: DriverEnv): string {
  const media =
    d.media.driver === 's3'
      ? `s3 (бакет ${d.media.bucket})`
      : d.media.root
        ? `local-fs (${d.media.root})`
        : 'local-fs';
  const mail = d.mail.driver === 'smtp' ? `smtp (від ${d.mail.from})` : 'log';
  return `медіа: ${media}, пошта: ${mail}`;
}
