import { useEffect, useMemo, useState } from 'react';
import type { z, ZodObject, ZodRawShape } from 'zod';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';

/**
 * Читання ВЛАСНОГО конфіга плагіна з рядка `plugins.config` (RLS: select
 * дозволений усім) — замикає цикл налаштувань: автор декларує Zod-схему в
 * `definePlugin`, адмінка редагує форму, плагін читає значення цим хуком.
 *
 * Схема тут — і валідація, і джерело дефолтів: порожній/битий config
 * парситься через `schema.safeParse`, тож поля з `.default()` завжди
 * матеріалізовані. Битий config → дефолти + console.warn, не падіння.
 */

/** Ланцюжок supabase-js, який використовує хук (див. коментар у usePluginTable). */
interface ConfigClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): {
        maybeSingle(): PromiseLike<{
          data: { config: unknown } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export interface PluginConfigResult<S extends ZodObject<ZodRawShape>> {
  /** Розпарсений конфіг із матеріалізованими дефолтами; `null` — ще вантажиться. */
  config: z.output<S> | null;
  loading: boolean;
}

export function usePluginConfig<S extends ZodObject<ZodRawShape>>(
  pluginName: string,
  schema: S,
): PluginConfigResult<S> {
  const client = useSupabaseClient() as unknown as ConfigClient;
  const [raw, setRaw] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await client
        .from('plugins')
        .select('config')
        .eq('name', pluginName)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn(
          `[plugin-sdk] usePluginConfig("${pluginName}"): ${error.message}`,
        );
      } else if (data === null) {
        // Рядка немає — типово розсинхрон конфіг-ключа з manifest.name
        // (usePluginConfig читає за manifest-імʼям, а рядок створює
        // bootstrap за ключем конфігу). Мовчати не можна: адмінка «успішно»
        // зберігала б налаштування, які плагін ніколи не побачить.
        console.warn(
          `[plugin-sdk] usePluginConfig("${pluginName}"): рядка plugins із таким name немає — віддаю дефолти схеми`,
        );
      }
      setRaw(data?.config ?? {});
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, pluginName]);

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

  return { config, loading };
}
