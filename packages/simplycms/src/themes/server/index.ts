import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { isAdminRequest } from 'simplycms/auth';
import { insertMissingThemes, selectThemeNames } from './registry-db';

/**
 * Серверна поверхня реєстру тем (B9/В2): рівно два `createServerFn` і НІ
 * ОДНОГО звичайного експорту.
 *
 * 🔴 Це не стиль. Модуль імпортує клієнтський `bootstrapThemes`, а Start
 * вирізає з браузерного бандла лише ТІЛА хендлерів; будь-який живий символ
 * поруч тримав би живим `./registry-db`, а з ним — пул Postgres.
 */

/** Ліміт колонки `themes.version` — varchar(20) (`schema/schema.ts`). */
const VERSION_MAX = 20;

const rowSchema = z.object({
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(100),
  version: z.string().min(1).max(VERSION_MAX),
  description: z.string().max(500).nullable(),
  author: z.string().max(100).nullable(),
});

/** Імена тем, відомих БД. Публічне читання — грант SELECT має і анонім. */
export const listThemeNames = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => selectThemeNames(),
);

/**
 * Зареєструвати в БД теми, встановлені пакетами/конфігом.
 *
 * 🔴 Право перевіряється ТУТ, із сесії запиту. `is_active` у схемі входу
 * немає взагалі — його задає сервер: інакше встановлення пакета могло б
 * мовчки перемкнути вітрину на чужу тему.
 */
export const registerThemes = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ rows: z.array(rowSchema).max(50) }))
  .handler(async ({ data: input }): Promise<number> => {
    const { rows } = input as { rows: z.output<typeof rowSchema>[] };
    return insertMissingThemes(
      rows,
      await isAdminRequest(getRequest().headers),
    );
  });
