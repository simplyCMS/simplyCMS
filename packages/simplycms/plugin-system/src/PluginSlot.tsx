import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { hookRegistry } from './HookRegistry';

interface PluginSlotProps<TContext = unknown> {
  name: string;
  context?: TContext;
  fallback?: ReactNode;
  wrapper?: (children: ReactNode[]) => ReactNode;
}

/**
 * Версія реєстру як синхронний снапшот.
 *
 * `hookRegistry.execute()` асинхронний (хендлери можуть бути async), а
 * `useSyncExternalStore` вимагає синхронного і стабільного за значенням
 * снапшота. Тому снапшот — це монотонне число `version`, а самі результати
 * досмоктуються ефектом, коли версія змінилась. На сервері реєстр той самий,
 * тож `getServerSnapshot` = `getVersion`.
 */
function useHookRegistryVersion(): number {
  return useSyncExternalStore(
    hookRegistry.subscribe,
    hookRegistry.getVersion,
    hookRegistry.getVersion,
  );
}

/** Поверхневе порівняння — щоб однаковий результат не крутив зайві рендери. */
function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

interface SlotState<T> {
  version: number;
  results: T[];
}

/**
 * Спільний контур слота: підписка на реєстр + асинхронне виконання хуків.
 * Стан тримає версію, для якої результати актуальні — доки вона відстає,
 * слот вважається таким, що ще виконується (`loading`).
 */
function useSlotResults<TContext, TResult>(
  name: string,
  context: TContext | undefined,
  label: string,
): { results: TResult[]; loading: boolean } {
  const version = useHookRegistryVersion();
  const [state, setState] = useState<SlotState<TResult>>({
    version: -1,
    results: [],
  });

  useEffect(() => {
    let cancelled = false;

    const commit = (results: TResult[]) => {
      if (cancelled) return;
      setState((prev) =>
        prev.version === version && sameItems(prev.results, results)
          ? prev
          : { version, results },
      );
    };

    hookRegistry
      .execute<TContext, TResult>(name, context as TContext)
      .then(commit)
      .catch((error) => {
        console.error(`Error in ${label} "${name}":`, error);
        commit([]);
      });

    return () => {
      cancelled = true;
    };
  }, [name, context, version, label]);

  const resolved = state.version === version;
  return { results: resolved ? state.results : [], loading: !resolved };
}

/**
 * Слот розширення. Реактивний до `HookRegistry`: `activatePlugin`/
 * `deactivatePlugin` викликають `register`/`unregister`, реєстр нотифікує
 * підписників — і віджет зʼявляється/зникає живцем, без перезавантаження
 * сторінки.
 */
export function PluginSlot<TContext = unknown>({
  name,
  context,
  fallback = null,
  wrapper,
}: PluginSlotProps<TContext>) {
  const { results, loading } = useSlotResults<TContext, ReactNode>(
    name,
    context,
    'plugin slot',
  );

  if (loading) {
    return null;
  }

  const components = results.filter((r) => r !== null && r !== undefined);

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

/** Ті самі результати поза JSX-слотом (той самий реактивний контур). */
export function usePluginSlot<TContext = unknown, TResult = unknown>(
  name: string,
  context?: TContext,
): { results: TResult[]; loading: boolean } {
  return useSlotResults<TContext, TResult>(name, context, 'usePluginSlot');
}

// Get handlers count for a specific hook
export function getPluginSlotCount(name: string): number {
  return hookRegistry.getHandlers(name).length;
}
