import type { ReactNode } from 'react';
import { Link, useRouter } from '@tanstack/react-router';

interface ViewLinkProps {
  /** Готовий href із view-model-а (крихти, «назад до каталогу»). */
  to: string;
  className?: string;
  children: ReactNode;
}

/**
 * Лінк view-шару теми.
 *
 * 🔴 Чому не просто `Link`, а обгортка. Conformance-гейт контракту v3
 * рендерить заявлені темою views БЕЗ роутера — kit піднімати його не мусить
 * (він перевіряє тему, а не навігацію). А `Link` без `RouterProvider` падає:
 * `useLinkProps` читає `router.isServer` з `undefined`. Ядро обходить це
 * моком `vi.mock('@tanstack/react-router')` у своєму vitest-тесті, але
 * КАНОНІЧНИЙ канал гейта (`pnpm simplycms theme:conformance <name>`) моків не
 * має в принципі: він імпортує тему справжнім графом модулів vite. Тому лінк
 * теми деградує до `<a>` сам, коли роутера в контексті немає, — і тема
 * проходить гейт обома каналами без жодного моку, зберігаючи клієнтську
 * навігацію у проді.
 *
 * `useRouter({ warn: false })` поза провайдером лише повертає `undefined`;
 * ворнінг вимкнено свідомо — у прогоні гейта він був би шумом, а не сигналом.
 */
export function ViewLink({ to, className, children }: ViewLinkProps) {
  const router = useRouter({ warn: false });

  if (!router) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}
