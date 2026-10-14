// @vitest-environment jsdom
// Контракт CMSProvider: клієнт роутера використовується БЕЗ ЗМІН — власного
// запасного клієнта провайдер не має.
//
// 🔴 Цей тест сам собою НЕ доводить нову топологію (QueryClient народжується
// в getRouter()): реалізація з двома різними клієнтами (один у роутері,
// другий створений провайдером) теж пройшла б його. Топологію доводить
// інтеграційний `tests/router-query-client.test.ts` + живий браузерний
// прогін (гідрація) — див. task-7-brief.md.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { CMSProvider } from '../providers/CMSProvider';

// Авто-cleanup RTL у репо вимкнено (globals: false) — дерево знімаємо в
// afterEach, щоб жодна робота React не пережила тест (і щоб cleanup
// виконувався навіть коли expect впаде).
afterEach(cleanup);

// 🔴 Справжній клієнт Better Auth тут не можна: атом сесії на монтуванні
// ставить `setTimeout(0)` і б'є `fetch` у `/api/auth/get-session` (jsdom —
// http://localhost:3000). Запит переживає тест, його відповідь оновлює дерево
// вже ПІСЛЯ кінця тесту, і задача планувальника React (`window.event` у
// відкладеному flush пасивних ефектів) могла виконатись після teardown jsdom →
// unhandled `ReferenceError: window is not defined`, що валив `pnpm test`.
// Самого cleanup для цього замало: nanostores знімає атом із затримкою
// 1 с, і cleanup Better Auth (`window.removeEventListener`) так само
// спрацьовує після teardown. Сесія для контракту QueryClient байдужа — гість.
vi.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signOut: async () => {},
  },
}));

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
