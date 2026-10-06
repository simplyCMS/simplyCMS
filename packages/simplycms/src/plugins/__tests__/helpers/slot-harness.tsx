import { useEffect } from 'react';
import { act } from '@testing-library/react';
import { registerPluginModule } from '../../PluginLoader';

// Спільний стенд для тестів слотів і toggle-а плагіна. Не є тестовим файлом
// (`*.test.*` — маска vitest), тому окремо не запускається.

export const HOOK = 'admin.dashboard.widgets';
export const PLUGIN = 'toggle-demo';

let markerMounts = 0;

/** Скільки разів сусіднє піддерево монтувалося з початку тесту. */
export function markerMountCount(): number {
  return markerMounts;
}

export function resetMarkerMounts(): void {
  markerMounts = 0;
}

/** Лічильник монтувань сусіда — доводить, що піддерево не перемонтовується. */
export function Marker() {
  useEffect(() => {
    markerMounts += 1;
  }, []);
  return <span data-testid="marker" />;
}

/**
 * Довести, що слот стабілізувався ПІСЛЯ монтування: перший `execute()`
 * асинхронний, його `.then(commit)` робить `setState` і сам по собі спричиняє
 * зайвий рендер. Якщо реєструвати плагін до цього резолву, віджет зʼявиться
 * навіть з мертвою підпискою — тест доводив би не те. Тому спершу вичерпуємо
 * усі мікротаски й лише тоді чіпаємо реєстр.
 */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Плагін-двійник у реєстрі модулів — джерело віджета `W` для слота. */
export function registerDemoPlugin(): void {
  registerPluginModule(PLUGIN, {
    register: (registry) => registry.register(HOOK, PLUGIN, () => <b>W</b>),
    unregister: (registry) => registry.unregister(HOOK, PLUGIN),
  });
}
