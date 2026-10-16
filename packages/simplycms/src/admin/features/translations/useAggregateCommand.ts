import { createContext, useContext, useRef, useState } from 'react';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';

/**
 * Версія агрегата, яку картка бачила востаннє: початкова — з `products.get`,
 * далі — з відповіді кожної команди. Це ref, а не state: версія потрібна лише
 * обробникам подій, а її зміна не мусить перемальовувати картку.
 */
export interface AggregateVersionStore {
  get(): number;
  set(version: number): void;
}

export function useAggregateVersionStore(
  initial: number,
): AggregateVersionStore {
  const ref = useRef(initial);
  const [store] = useState<AggregateVersionStore>(() => ({
    get: () => ref.current,
    set: (v) => {
      ref.current = v;
    },
  }));
  return store;
}

export const AggregateVersionContext =
  createContext<AggregateVersionStore | null>(null);

export interface AggregateCommandOptions {
  /** Версія розійшлась (412): картка показує діалог, введене не скидає. */
  readonly onConflict: (currentVersion: number) => void;
}

/** Чи це `VersionMismatchError` (дуком: клас серверний, на клієнті лише `name`). */
export function isVersionMismatch(
  e: unknown,
): e is { name: string; currentVersion?: unknown } {
  return (
    (e as { name?: unknown } | null)?.name === DOMAIN_ERROR_NAME.versionMismatch
  );
}

type Versioned = { readonly version?: number };

/**
 * Команда агрегата з оптимістичною версією (І14). Один виклик `run` = один
 * запит; `expectedVersion` береться з останнього `products.get` (стор картки),
 * після успіху стор отримує нову `version` з відповіді. 412 повертає `null` і
 * кличе `onConflict` — помилкою це не є, бо діалог конфлікту обробляє картка.
 * Решта помилок (валідація, мережа) йдуть викликачу як є.
 */
export function useAggregateCommand<I extends object, O extends Versioned>(
  serverFn: (args: { data: I & { expectedVersion: number } }) => Promise<O>,
  { onConflict }: AggregateCommandOptions,
) {
  const store = useContext(AggregateVersionContext);
  if (!store)
    throw new Error(
      '[translations] no AggregateVersionContext in the card tree',
    );
  const [isPending, setPending] = useState(false);

  const run = async (input: I): Promise<O | null> => {
    setPending(true);
    try {
      const out = await serverFn({
        data: { ...input, expectedVersion: store.get() },
      });
      if (typeof out.version === 'number') store.set(out.version);
      return out;
    } catch (e) {
      if (isVersionMismatch(e)) {
        const current = Number(e.currentVersion);
        onConflict(Number.isFinite(current) ? current : store.get());
        return null;
      }
      throw e;
    } finally {
      setPending(false);
    }
  };

  return { run, isPending };
}
