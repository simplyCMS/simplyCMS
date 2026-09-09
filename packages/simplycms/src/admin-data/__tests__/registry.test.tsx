// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви renderHook упаде
// на document is not defined; патерн — як у сусідніх hook-тестах репо)
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getCollection, useCollection, type CollectionDef } from '../registry';

const probeDef: CollectionDef<{ marker: string }> = {
  id: 'probe',
  create: () => ({ marker: Math.random().toString(36) }),
};

const wrap = (client: QueryClient) =>
  function W({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

describe('admin-data/registry', () => {
  it('той самий QueryClient — той самий інстанс (typed, без ре-створення)', () => {
    const client = new QueryClient();
    const { result, rerender } = renderHook(() => useCollection(probeDef), {
      wrapper: wrap(client),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(getCollection(client, probeDef)).toBe(first);
  });

  it('різні QueryClient — різні інстанси (нуль протікання між запитами)', () => {
    const a = getCollection(new QueryClient(), probeDef);
    const b = getCollection(new QueryClient(), probeDef);
    expect(a).not.toBe(b);
  });
});
