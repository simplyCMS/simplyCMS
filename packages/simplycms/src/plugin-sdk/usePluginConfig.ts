import { useCallback, useEffect, useMemo, useState } from 'react';
import type { z, ZodObject, ZodRawShape } from 'zod';
import type { JsonValue } from 'simplycms/storefront/loaders';
import {
  pluginConfigRead,
  pluginConfigWrite,
} from 'simplycms/plugin-sdk/server';

/**
 * Читання й запис ВЛАСНОГО конфіга плагіна (рядок `plugins.config`) —
 * замикає цикл налаштувань: автор декларує Zod-схему в `definePlugin`,
 * адмінка редагує форму, плагін читає значення цим хуком.
 *
 * Схема тут — і валідація, і джерело дефолтів: порожній/битий config
 * парситься через `schema.safeParse`, тож поля з `.default()` завжди
 * матеріалізовані. Битий config → дефолти + console.warn, не падіння.
 *
 * 🔴 Транспорт — serverFn (рішення B9): браузер до БД не звертається. Запис
 * дозволений лише адміну, і перевіряє це СЕРВЕР — `save` віддає `false`,
 * коли права немає.
 */

export interface PluginConfigResult<S extends ZodObject<ZodRawShape>> {
  /** Розпарсений конфіг із матеріалізованими дефолтами; `null` — ще вантажиться. */
  config: z.output<S> | null;
  loading: boolean;
  /** Зберегти конфіг (лише адмін). `false` — сервер відмовив у праві. */
  save: (next: z.input<S>) => Promise<boolean>;
}

export function usePluginConfig<S extends ZodObject<ZodRawShape>>(
  pluginName: string,
  schema: S,
): PluginConfigResult<S> {
  const [raw, setRaw] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await pluginConfigRead({ data: { plugin: pluginName } });
        if (cancelled) return;
        if (!result.found) {
          // Рядка немає — типово розсинхрон ключа конфігу з manifest.name
          // (хук читає за manifest-імʼям, а рядок створює bootstrap за
          // ключем конфігу). Мовчати не можна: адмінка «успішно» зберігала б
          // налаштування, які плагін ніколи не побачить.
          console.warn(
            `[plugin-sdk] usePluginConfig("${pluginName}"): рядка plugins із таким name немає — віддаю дефолти схеми`,
          );
        }
        setRaw(result.config ?? {});
      } catch (error) {
        if (cancelled) return;
        console.warn(`[plugin-sdk] usePluginConfig("${pluginName}"):`, error);
        setRaw({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pluginName]);

  const config = useMemo(() => {
    if (loading) return null;
    const parsed = schema.safeParse(raw ?? {});
    if (parsed.success) return parsed.data;
    console.warn(
      `[plugin-sdk] usePluginConfig("${pluginName}"): config не пройшов схему — дефолти`,
    );
    const fallback = schema.safeParse({});
    return fallback.success ? fallback.data : null;
  }, [loading, raw, schema, pluginName]);

  const save = useCallback(
    async (next: z.input<S>): Promise<boolean> => {
      // Валідуємо ДО запиту: битий конфіг не має шансу лягти в БД навіть у
      // адміна — саме схема плагіна тут єдиний опис форми значення.
      const parsed = schema.safeParse(next);
      if (!parsed.success) {
        console.warn(
          `[plugin-sdk] usePluginConfig("${pluginName}"): save відхилено схемою`,
        );
        return false;
      }

      const written = await pluginConfigWrite({
        data: {
          plugin: pluginName,
          // Значення вже пройшло схему плагіна — далі його форму описує
          // тільки JSON, бо саме ним воно їде на сервер.
          config: parsed.data as Record<string, JsonValue>,
        },
      });
      if (written) setRaw(parsed.data);
      return written;
    },
    [pluginName, schema],
  );

  return { config, loading, save };
}
