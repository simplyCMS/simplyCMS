import { supabase } from "@/integrations/supabase/client";
import { hookRegistry } from "./HookRegistry";
import { Plugin, PluginModule } from "./types";

// Map of available plugins (will be populated by dynamic imports)
const pluginModules: Map<string, PluginModule> = new Map();

// Register a plugin module (called during app initialization)
export function registerPluginModule(name: string, module: PluginModule): void {
  pluginModules.set(name, module);
}

// Get all registered plugin modules
export function getRegisteredPluginModules(): Map<string, PluginModule> {
  return pluginModules;
}

// Load and activate all active plugins from database
export async function loadPlugins(): Promise<Plugin[]> {
  try {
    const { data: plugins, error } = await supabase
      .from("plugins")
      .select("*")
      .eq("is_active", true)
      .order("installed_at", { ascending: true });

    if (error) {
      console.error("Error loading plugins:", error);
      return [];
    }

    const loadedPlugins: Plugin[] = [];

    for (const plugin of plugins || []) {
      try {
        const module = pluginModules.get(plugin.name);
        
        if (module) {
          module.register(hookRegistry);
          loadedPlugins.push(plugin as Plugin);
          console.log(`Plugin "${plugin.display_name}" loaded successfully`);
        } else {
          console.warn(`Plugin module "${plugin.name}" not found in registry`);
        }
      } catch (err) {
        console.error(`Error loading plugin "${plugin.name}":`, err);
      }
    }

    return loadedPlugins;
  } catch (err) {
    console.error("Error in loadPlugins:", err);
    return [];
  }
}

// Activate a specific plugin
export async function activatePlugin(pluginName: string): Promise<boolean> {
  const module = pluginModules.get(pluginName);
  
  if (!module) {
    console.error(`Plugin module "${pluginName}" not found`);
    return false;
  }

  try {
    module.register(hookRegistry);
    
    const { error } = await supabase
      .from("plugins")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("name", pluginName);

    if (error) {
      console.error("Error activating plugin in database:", error);
      return false;
    }

    console.log(`Plugin "${pluginName}" activated`);
    return true;
  } catch (err) {
    console.error(`Error activating plugin "${pluginName}":`, err);
    return false;
  }
}

// Deactivate a specific plugin
export async function deactivatePlugin(pluginName: string): Promise<boolean> {
  const module = pluginModules.get(pluginName);
  
  if (module?.unregister) {
    module.unregister(hookRegistry);
  }

  try {
    const { error } = await supabase
      .from("plugins")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("name", pluginName);

    if (error) {
      console.error("Error deactivating plugin in database:", error);
      return false;
    }

    // Remove all handlers from this plugin
    const hooks = hookRegistry.getRegisteredHooks();
    for (const hook of hooks) {
      hookRegistry.unregister(hook, pluginName);
    }

    console.log(`Plugin "${pluginName}" deactivated`);
    return true;
  } catch (err) {
    console.error(`Error deactivating plugin "${pluginName}":`, err);
    return false;
  }
}

// Get all plugins from database
export async function getAllPlugins(): Promise<Plugin[]> {
  const { data, error } = await supabase
    .from("plugins")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Error fetching plugins:", error);
    return [];
  }

  return (data || []) as Plugin[];
}

// Update plugin configuration
export async function updatePluginConfig(
  pluginName: string,
  config: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from("plugins")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ config: config as any, updated_at: new Date().toISOString() })
    .eq("name", pluginName);

  if (error) {
    console.error("Error updating plugin config:", error);
    return false;
  }

  return true;
}

// Install a new plugin (add to database)
export async function installPlugin(
  name: string,
  displayName: string,
  version: string,
  description?: string,
  author?: string,
  hooks?: { name: string; priority?: number }[]
): Promise<Plugin | null> {
  const { data, error } = await supabase
    .from("plugins")
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
    console.error("Error installing plugin:", error);
    return null;
  }

  return data as Plugin;
}

// Uninstall a plugin (remove from database)
export async function uninstallPlugin(pluginName: string): Promise<boolean> {
  // First deactivate
  await deactivatePlugin(pluginName);

  const { error } = await supabase
    .from("plugins")
    .delete()
    .eq("name", pluginName);

  if (error) {
    console.error("Error uninstalling plugin:", error);
    return false;
  }

  return true;
}
