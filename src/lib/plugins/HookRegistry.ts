import {
  HookHandler,
  HookRegistryInterface,
  RegisteredHook,
} from "./types";

class HookRegistry implements HookRegistryInterface {
  private hooks: Map<string, RegisteredHook[]> = new Map();

  register<TContext = unknown, TResult = unknown>(
    hookName: string,
    pluginName: string,
    handler: HookHandler<TContext, TResult>,
    priority: number = 10
  ): void {
    const existing = this.hooks.get(hookName) || [];
    
    // Remove any existing handler from the same plugin
    const filtered = existing.filter((h) => h.pluginName !== pluginName);
    
    filtered.push({
      pluginName,
      handler: handler as HookHandler,
      priority,
    });
    
    // Sort by priority (lower = earlier)
    filtered.sort((a, b) => a.priority - b.priority);
    
    this.hooks.set(hookName, filtered);
  }

  unregister(hookName: string, pluginName: string): void {
    const existing = this.hooks.get(hookName);
    if (!existing) return;
    
    const filtered = existing.filter((h) => h.pluginName !== pluginName);
    
    if (filtered.length === 0) {
      this.hooks.delete(hookName);
    } else {
      this.hooks.set(hookName, filtered);
    }
  }

  async execute<TContext = unknown, TResult = unknown>(
    hookName: string,
    context: TContext
  ): Promise<TResult[]> {
    const handlers = this.hooks.get(hookName) || [];
    const results: TResult[] = [];
    
    for (const { handler } of handlers) {
      try {
        const result = await handler(context);
        if (result !== undefined && result !== null) {
          results.push(result as TResult);
        }
      } catch (error) {
        console.error(
          `Error executing hook "${hookName}" from plugin:`,
          error
        );
      }
    }
    
    return results;
  }

  getHandlers<TContext = unknown, TResult = unknown>(
    hookName: string
  ): RegisteredHook<TContext, TResult>[] {
    return (this.hooks.get(hookName) || []) as RegisteredHook<TContext, TResult>[];
  }

  getRegisteredHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  getPluginsForHook(hookName: string): string[] {
    const handlers = this.hooks.get(hookName) || [];
    return handlers.map((h) => h.pluginName);
  }

  clear(): void {
    this.hooks.clear();
  }
}

// Singleton instance
export const hookRegistry = new HookRegistry();

export default HookRegistry;
