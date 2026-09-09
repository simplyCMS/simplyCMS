import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { isAdminRequest } from 'simplycms/auth';
import type { JsonValue } from 'simplycms/storefront/loaders';
import { selectPluginConfig, savePluginConfig } from './config-db';
import {
  deletePluginRow,
  insertPluginRow,
  selectPluginRows,
  updatePluginRow,
  type PluginRow,
} from './table-db';

/**
 * Транспорт портів плагіна (рішення B9 спеки v2). Лише `createServerFn` —
 * жодного звичайного експорту (див. докблок у `themes/server/index.ts`).
 *
 * 🔴 Контракт назовні бекенд-нейтральний: плагін називає таблицю й фільтри,
 * а ЧИМ це виконано (Postgres, `withActor`, роль транзакції) з SDK не видно
 * взагалі — саме тому порт пережив зміну бекенда без правок у плагінах.
 */

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const target = z.object({
  plugin: z.string().min(1).max(100),
  table: z.string().min(1).max(63),
});

/** Читання власної таблиці плагіна. Публічне: слоти вітрини бачить і гість. */
export const pluginTableList = createServerFn({ method: 'GET' })
  .inputValidator(
    target.extend({
      eq: z.record(z.string(), cell).optional(),
      orderBy: z.string().max(63).optional(),
      ascending: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<PluginRow[]> => {
    const input = data as z.output<typeof target> & {
      eq?: Record<string, z.output<typeof cell>>;
      orderBy?: string;
      ascending?: boolean;
    };
    return selectPluginRows(input.plugin, input.table, input);
  });

/** Вставка рядка — лише адмін. */
export const pluginTableInsert = createServerFn({ method: 'POST' })
  .inputValidator(target.extend({ row: z.record(z.string(), cell) }))
  .handler(async ({ data }): Promise<PluginRow> => {
    const input = data as z.output<typeof target> & {
      row: Record<string, z.output<typeof cell>>;
    };
    await requireAdmin();
    return insertPluginRow(input.plugin, input.table, input.row);
  });

/** Оновлення рядка за `id` — лише адмін. */
export const pluginTableUpdate = createServerFn({ method: 'POST' })
  .inputValidator(
    target.extend({
      id: z.string().min(1).max(64),
      patch: z.record(z.string(), cell),
    }),
  )
  .handler(async ({ data }): Promise<PluginRow> => {
    const input = data as z.output<typeof target> & {
      id: string;
      patch: Record<string, z.output<typeof cell>>;
    };
    await requireAdmin();
    return updatePluginRow(input.plugin, input.table, input.id, input.patch);
  });

/** Видалення рядка за `id` — лише адмін. */
export const pluginTableRemove = createServerFn({ method: 'POST' })
  .inputValidator(target.extend({ id: z.string().min(1).max(64) }))
  .handler(async ({ data }): Promise<void> => {
    const input = data as z.output<typeof target> & { id: string };
    await requireAdmin();
    await deletePluginRow(input.plugin, input.table, input.id);
  });

/** Конфіг плагіна: `found: false` — рядка з таким `name` у БД немає. */
export const pluginConfigRead = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ plugin: z.string().min(1).max(100) }))
  .handler(async ({ data }): Promise<{ found: boolean; config: JsonValue }> =>
    selectPluginConfig((data as { plugin: string }).plugin),
  );

/** Запис конфіга плагіна — лише адмін; `false` означає відмову доступу. */
export const pluginConfigWrite = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      plugin: z.string().min(1).max(100),
      config: z.record(z.string(), z.json()),
    }),
  )
  .handler(async ({ data }): Promise<boolean> => {
    const input = data as { plugin: string; config: Record<string, JsonValue> };
    return savePluginConfig(
      input.plugin,
      input.config,
      await isAdminRequest(getRequest().headers),
    );
  });

/**
 * 🔴 Мутації падають ДО походу в БД, а не покладаються на грант. Роль
 * `app_admin` вмикається типізованою перевіркою в TS (перший рубіж B5″), тож
 * хендлер, який пустив би чужий запит під нею, зняв би цей рубіж власноруч.
 */
async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest(getRequest().headers))) {
    throw new Error('[plugin-sdk] Запис у таблицю плагіна доступний адміну.');
  }
}
