import { ReactNode, useEffect, useState } from "react";
import { hookRegistry } from "@/lib/plugins/HookRegistry";

interface PluginSlotProps<TContext = unknown> {
  name: string;
  context?: TContext;
  fallback?: ReactNode;
  wrapper?: (children: ReactNode[]) => ReactNode;
}

export function PluginSlot<TContext = unknown>({
  name,
  context,
  fallback = null,
  wrapper,
}: PluginSlotProps<TContext>) {
  const [components, setComponents] = useState<ReactNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function executeHooks() {
      try {
        const results = await hookRegistry.execute<TContext, ReactNode>(
          name,
          context as TContext
        );
        setComponents(results.filter((r) => r !== null && r !== undefined));
      } catch (error) {
        console.error(`Error executing plugin slot "${name}":`, error);
        setComponents([]);
      } finally {
        setLoading(false);
      }
    }

    executeHooks();
  }, [name, context]);

  if (loading) {
    return null;
  }

  if (components.length === 0) {
    return <>{fallback}</>;
  }

  if (wrapper) {
    return <>{wrapper(components)}</>;
  }

  return (
    <>
      {components.map((component, index) => (
        <div key={`${name}-${index}`}>{component}</div>
      ))}
    </>
  );
}

// Hook to get plugin slot results synchronously (for non-React contexts)
export function usePluginSlot<TContext = unknown, TResult = unknown>(
  name: string,
  context?: TContext
): { results: TResult[]; loading: boolean } {
  const [results, setResults] = useState<TResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function executeHooks() {
      try {
        const hookResults = await hookRegistry.execute<TContext, TResult>(
          name,
          context as TContext
        );
        setResults(hookResults);
      } catch (error) {
        console.error(`Error in usePluginSlot "${name}":`, error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    executeHooks();
  }, [name, context]);

  return { results, loading };
}

// Get handlers count for a specific hook
export function getPluginSlotCount(name: string): number {
  return hookRegistry.getHandlers(name).length;
}
