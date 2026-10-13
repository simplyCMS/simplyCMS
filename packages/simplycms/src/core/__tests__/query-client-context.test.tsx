// @vitest-environment jsdom
// Контракт CMSProvider: клієнт роутера використовується БЕЗ ЗМІН — власного
// запасного клієнта провайдер не має.
//
// 🔴 Цей тест сам собою НЕ доводить нову топологію (QueryClient народжується
// в getRouter()): реалізація з двома різними клієнтами (один у роутері,
// другий створений провайдером) теж пройшла б його. Топологію доводить
// інтеграційний `tests/router-query-client.test.ts` + живий браузерний
// прогін (гідрація) — див. task-7-brief.md.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { CMSProvider } from '../providers/CMSProvider';

function Probe({ onClient }: { onClient: (c: QueryClient) => void }) {
  onClient(useQueryClient());
  return null;
}

describe('CMSProvider: клієнт приходить ззовні', () => {
  it('використовує переданий QueryClient, а не створює власний', () => {
    const external = new QueryClient();
    let seen: QueryClient | null = null;

    render(
      <CMSProvider queryClient={external}>
        <Probe
          onClient={(c) => {
            seen = c;
          }}
        />
      </CMSProvider>,
    );

    // 🔴 Саме той самий інстанс: колекції TanStack DB memoізуються по
    // QueryClient, і другий інстанс дав би другий набір колекцій —
    // тобто тихий розсинхрон між loader і компонентом.
    expect(seen).toBe(external);
  });
});
