import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from 'simplycms/contracts';
import type { Plugin } from './types';

/**
 * Шар доступу до таблиці `plugins`. HookRegistry тут не згадується навмисно:
 * lifecycle (`PluginLoader`) спершу дочікується підтвердженого запису в БД і
 * лише потім мутує реєстр — інакше збій БД лишив би «привидний» стан у памʼяті.
 */

/** Активні плагіни в порядку встановлення. `null` — помилка читання. */
export async function fetchActivePlugins(
  supabase: SupabaseClient,
): Promise<Plugin[] | null> {
  const { data, error } = await supabase
    .from('plugins')
    .select('*')
    .eq('is_active', true)
    .order('installed_at', { ascending: true });

  if (error) {
    console.error('Error loading plugins:', error);
    return null;
  }

  return (data || []) as Plugin[];
}

/** Перемикання прапорця `is_active`. `false` — БД відмовила. */
export async function setPluginActive(
  supabase: SupabaseClient,
  pluginName: string,
  isActive: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('plugins')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('name', pluginName);

  if (error) {
    console.error(
      `Error ${isActive ? 'activating' : 'deactivating'} plugin "${pluginName}" in database:`,
      error,
    );
    return false;
  }

  return true;
}

// Get all plugins from database
export async function getAllPlugins(
  supabase: SupabaseClient,
): Promise<Plugin[]> {
  const { data, error } = await supabase
    .from('plugins')
    .select('*')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Error fetching plugins:', error);
    return [];
  }

  return (data || []) as Plugin[];
}

// Update plugin configuration
export async function updatePluginConfig(
  supabase: SupabaseClient,
  pluginName: string,
  config: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase
    .from('plugins')
    .update({
      config: config as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('name', pluginName);

  if (error) {
    console.error('Error updating plugin config:', error);
    return false;
  }

  return true;
}

// Install a new plugin (add to database)
export async function installPlugin(
  supabase: SupabaseClient,
  name: string,
  displayName: string,
  version: string,
  description?: string,
  author?: string,
  hooks?: { name: string; priority?: number }[],
): Promise<Plugin | null> {
  const { data, error } = await supabase
    .from('plugins')
    .insert({
      name,
      display_name: displayName,
      version,
      description,
      author,
      hooks: hooks || [],
      is_active: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error installing plugin:', error);
    return null;
  }

  return data as Plugin;
}

/** Видалення рядка плагіна. Реєстр чистить `uninstallPlugin` у lifecycle. */
export async function deletePluginRow(
  supabase: SupabaseClient,
  pluginName: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('plugins')
    .delete()
    .eq('name', pluginName);

  if (error) {
    console.error('Error uninstalling plugin:', error);
    return false;
  }

  return true;
}
