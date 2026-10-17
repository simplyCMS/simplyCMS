import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT;

// Відхилення від реєстру shadcn (там `useState` + `setState` в ефекті, що
// ловить `react-hooks/set-state-in-effect`): підписка на зовнішнє джерело —
// канонічний випадок `useSyncExternalStore`. Серверний снапшот — детермінований
// `false`: SSR вітрини й перший клієнтський рендер гідратації збігаються (той
// самий результат, що давав `!!undefined` у версії реєстру).
const getServerSnapshot = () => false;

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
