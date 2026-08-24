import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { isAdminRequest } from 'simplycms/auth';
import type { PluginRecord } from '../types';
import {
  insertMissingPlugins,
  selectActivePlugins,
  selectPluginNames,
} from './registry-db';

/**
 * Серверна поверхня реєстру плагінів (B9/В2): лише `createServerFn`.
 * Жодного звичайного експорту — інакше пул Postgres поїхав би в браузер
 * разом із `bootstrapPlugins` (див. докблок у `themes/server/index.ts`).
 */

const rowSchema = z.object({
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(100),
  version: z.string().min(1).max(50),
  description: z.string().max(500).nullable(),
  author: z.string().max(100).nullable(),
  hooks: z.array(
    z.object({ name: z.string().min(1), priority: z.number().optional() }),
  ),
});

/** Імена плагінів, відомих БД. Публічне читання. */
export const listPluginNames = createServerFn({ method: 'GET' }).handler(
  async (): Promise<string[]> => selectPluginNames(),
);

/** Активні плагіни — рантайм вмикає їхні хуки в реєстрі. */
export const listActivePlugins = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PluginRecord[]> => selectActivePlugins(),
);

/**
 * Зареєструвати в БД плагіни, встановлені конфігом магазину.
 *
 * 🔴 `is_active` у схемі входу немає: встановлення пакета не сміє вмикати
 * плагін — це окреме рішення адміна в адмінці.
 */
export const registerPlugins = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ rows: z.array(rowSchema).max(100) }))
  .handler(async ({ data: input }): Promise<number> => {
    const { rows } = input as { rows: z.output<typeof rowSchema>[] };
    return insertMissingPlugins(
      rows,
      await isAdminRequest(getRequest().headers),
    );
  });
