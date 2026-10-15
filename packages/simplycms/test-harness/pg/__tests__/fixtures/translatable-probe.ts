// М1 Task 4: одноразова пара «база + переклади» для доказу узагальненого
// тригера `require_source_translation()` (Р3, І4–І5) без жодної продуктової
// таблиці. Продуктові таблиці підключає Task 17, плагінні — М2; обидва кличуть
// ту саму процедуру `attach_source_translation_triggers`, тож probe доводить
// саме її, а не копію DDL.
//
// 🔴 Тригер НЕ вішається вручну: probe звертається до процедури підключення,
// інакше тест міряв би власний DDL, а перелік `UPDATE OF` і `TG_ARGV[4]`
// могли б розійтися з тим, що отримає прод.
import pg from 'pg';

/** Мінімум, потрібний хелперові від зʼєднання (`pg.Client`, пул чи обгортка). */
export interface SqlClient {
  query(sql: string): Promise<unknown>;
}

/** Імена probe-таблиць: сирі (для TG_ARGV) і готові до підстановки в SQL. */
export interface TranslatableProbe {
  /** Сире імʼя бази — без лапок, як його бачить `TG_ARGV[1]`. */
  base: string;
  /** Сире імʼя таблиці перекладів — `TG_ARGV[2]`. */
  translations: string;
  /** Ідентифікатор бази для SQL (з лапками, якщо потрібні). */
  baseSql: string;
  /** Ідентифікатор таблиці перекладів для SQL. */
  translationsSql: string;
}

/** SQL-ідентифікатор: усі лапки подвоюються — тому `probe_q"x` безпечний. */
export const quoteIdent = (name: string): string =>
  `"${name.replaceAll('"', '""')}"`;

/** SQL-літерал рядка (одинарні лапки подвоюються). */
export const quoteLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`;

export interface ProbeOptions {
  /** Обовʼязкові колонки перекладу; типово лише `name` (`note` — вільна). */
  required?: string[];
  /** Умова `[5]` на базовому рядку: `kind=text`. */
  condition?: string;
}

/**
 * Створює `probe_<name>` і `probe_<name>_translations` та підключає тригери.
 * Нічого не коміттить: викликач сам вирішує, чи це частина його транзакції.
 * Гранти ролям додає тест — хелпер не знає, під ким той ходитиме.
 */
export async function createTranslatableProbe(
  client: SqlClient,
  name: string,
  options: ProbeOptions = {},
): Promise<TranslatableProbe> {
  const base = `probe_${name}`;
  const translations = `probe_${name}_translations`;
  const baseSql = quoteIdent(base);
  const translationsSql = quoteIdent(translations);
  const required = options.required ?? ['name'];

  // `id` задає викликач, не БД — та сама форма, що в таблицях «Категорії A».
  await client.query(
    `create table public.${baseSql} (id uuid primary key, kind text)`,
  );
  await client.query(
    `create table public.${translationsSql} (
       probe_id uuid not null references public.${baseSql}(id) on delete cascade,
       locale text not null references public.languages(code),
       name text,
       note text,
       primary key (probe_id, locale)
     )`,
  );
  const arr = `array[${required.map(quoteLiteral).join(', ')}]::text[]`;
  const cond = options.condition ? quoteLiteral(options.condition) : 'null';
  await client.query(
    `call public.attach_source_translation_triggers(
       ${quoteLiteral(baseSql)}::regclass,
       ${quoteLiteral(translationsSql)}::regclass,
       'probe_id', ${arr}, ${cond})`,
  );
  return { base, translations, baseSql, translationsSql };
}

/** `insert` базового рядка; `kind` — колонка умови `[5]`. */
export const insertBase = (
  p: TranslatableProbe,
  id: string,
  kind?: string,
): string =>
  `insert into public.${p.baseSql} (id, kind) values ('${id}', ${kind ? quoteLiteral(kind) : 'null'})`;

/** `insert` рядка перекладу; `null` лишає колонку порожньою. */
export const insertTranslation = (
  p: TranslatableProbe,
  id: string,
  locale: string,
  name: string | null,
  note: string | null = null,
): string => {
  const lit = (v: string | null) => (v === null ? 'null' : quoteLiteral(v));
  return `insert into public.${p.translationsSql} (probe_id, locale, name, note)
          values ('${id}', '${locale}', ${lit(name)}, ${lit(note)})`;
};

/** `update` рядків перекладу за довільною умовою. */
export const updateTranslations = (
  p: TranslatableProbe,
  set: string,
  where: string,
): string => `update public.${p.translationsSql} set ${set} where ${where}`;

/** Видалення базового рядка (переклади йдуть каскадом). */
export const deleteBase = (p: TranslatableProbe, id: string): string =>
  `delete from public.${p.baseSql} where id = '${id}'`;

/** Видалення рядка перекладу однієї мови. */
export const deleteTranslation = (
  p: TranslatableProbe,
  id: string,
  locale: string,
): string =>
  `delete from public.${p.translationsSql} where probe_id = '${id}' and locale = '${locale}'`;

/** Чотири probe-пари, що покривають усі гілки функції. */
export interface ProbeSet {
  main: TranslatableProbe;
  cond: TranslatableProbe;
  quoted: TranslatableProbe;
  multi: TranslatableProbe;
}

/**
 * Другу мову (`en`) і чотири probe-пари заводить власник БД однією транзакцією,
 * гранти `app_user`/`app_admin` видає теж він: актори лише користуються.
 * `quoted` має лапку в імені (`probe_q"x`) — доказ, що ідентифікатор у
 * `TG_ARGV` не конкатенується в SQL.
 */
export async function installProbeSet(dbUrl: string): Promise<ProbeSet> {
  const owner = new pg.Client({ connectionString: dbUrl });
  await owner.connect();
  try {
    await owner.query('begin');
    await owner.query(
      `insert into public.languages (id, code, name, status, is_default, sort_order)
       values (gen_random_uuid(), 'en', 'English', 'published', false, 1)`,
    );
    const set: ProbeSet = {
      main: await createTranslatableProbe(owner, 'main'),
      cond: await createTranslatableProbe(owner, 'cond', {
        condition: 'kind=text',
      }),
      quoted: await createTranslatableProbe(owner, 'q"x'),
      multi: await createTranslatableProbe(owner, 'multi', {
        required: ['name', 'note'],
      }),
    };
    for (const p of Object.values(set))
      await owner.query(
        `grant select, insert, update, delete on public.${p.baseSql}, public.${p.translationsSql} to app_user, app_admin`,
      );
    await owner.query('commit');
    return set;
  } finally {
    await owner.end();
  }
}
