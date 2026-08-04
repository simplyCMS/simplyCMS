// Інжекція EngineContext через React-контекст.
// Усі feature-хуки беруть залежності з useEngine() — ніколи не імпортують supabase напряму.

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { EngineContext } from '@simplycms/objects';

const EngineReactContext = createContext<EngineContext | null>(null);

export interface EngineProviderProps {
  value: EngineContext;
  children: ReactNode;
}

export function EngineProvider({ value, children }: EngineProviderProps) {
  return (
    <EngineReactContext.Provider value={value}>
      {children}
    </EngineReactContext.Provider>
  );
}

/** Доступ до контейнера залежностей рушія. Кидає помилку поза EngineProvider. */
export function useEngine(): EngineContext {
  const ctx = useContext(EngineReactContext);
  if (!ctx) {
    throw new Error('useEngine must be used within an <EngineProvider>');
  }
  return ctx;
}
