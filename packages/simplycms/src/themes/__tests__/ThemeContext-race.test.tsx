// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../ThemeContext';
import { useTheme } from '../theme-context';
import { ThemeRegistry } from '../ThemeRegistry';
import type { ThemeModule } from '../types';

/**
 * Дві швидкі зміни теми (власник активував A, одразу B): модулі вантажаться
 * асинхронно й можуть завершитись у зворотному порядку. Пізній результат A не
 * має перезаписати вже показану B — `ThemeProvider` відкидає застарілий
 * запит. Окремий файл — ліміт 150 рядків у `ThemeContext.test.tsx`.
 */

function makeTheme(name: string): ThemeModule {
  return {
    manifest: {
      name,
      displayName: name,
      version: '1.0.0',
      engines: { simplycms: '>=0.1.0' },
    },
    tokens: { primary: '221 83% 53%' },
    components: { Header: () => null, Footer: () => null },
  };
}

/** Тема, модуль якої «довантажиться», коли тест скаже. */
function deferredTheme(name: string) {
  let resolve!: () => void;
  const loaded = new Promise<{ default: ThemeModule }>((r) => {
    resolve = () => r({ default: makeTheme(name) });
  });
  ThemeRegistry.register(name, () => loaded);
  return resolve;
}

/**
 * `wrapper` у `renderHook` пропсів не отримує, тож провайдер рендериться
 * напряму, а останнє значення контексту ловить проба.
 */
function renderProvider(initial: string) {
  const result: { current: ReturnType<typeof useTheme> } = {
    current: undefined as never,
  };
  function Probe() {
    result.current = useTheme();
    return null;
  }
  const tree = (name: string) => (
    <ThemeProvider initialThemeName={name}>
      <Probe />
    </ThemeProvider>
  );
  const view = render(tree(initial));
  return { result, rerender: (name: string) => view.rerender(tree(name)) };
}

afterEach(() => {
  for (const name of ThemeRegistry.getRegisteredThemes()) {
    ThemeRegistry.unregister(name);
  }
  ThemeRegistry.clearCache();
  vi.restoreAllMocks();
});

describe('ThemeProvider — застарілий loadTheme відкидається', () => {
  it('A → B швидко, A довантажився ПІСЛЯ B → показано B', async () => {
    const resolveA = deferredTheme('theme-a');
    const resolveB = deferredTheme('theme-b');
    const { result, rerender } = renderProvider('theme-a');

    rerender('theme-b');
    await act(async () => resolveB());
    await waitFor(() => expect(result.current.themeName).toBe('theme-b'));

    await act(async () => resolveA());
    expect(result.current.themeName).toBe('theme-b');
    expect(result.current.activeTheme?.manifest.name).toBe('theme-b');
    expect(result.current.isLoading).toBe(false);
  });

  it('успіх після збою знімає error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ThemeRegistry.register('theme-ok', () =>
      Promise.resolve({ default: makeTheme('theme-ok') }),
    );
    const { result, rerender } = renderProvider('theme-missing');
    await waitFor(() => expect(result.current.error).not.toBeNull());

    rerender('theme-ok');
    await waitFor(() => expect(result.current.themeName).toBe('theme-ok'));
    expect(result.current.error).toBeNull();
  });
});
