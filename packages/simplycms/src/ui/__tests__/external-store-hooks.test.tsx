// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

/**
 * Задача 14в: `useIsMobile` і `Carousel` читають зовнішній стан через
 * `useSyncExternalStore`, а не `setState` в ефекті.
 */
const embla = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>();
  const state = { prev: false, next: true };
  const api = {
    canScrollPrev: () => state.prev,
    canScrollNext: () => state.next,
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on: (ev: string, cb: () => void) => {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev)!.add(cb);
    },
    off: (ev: string, cb: () => void) => listeners.get(ev)?.delete(cb),
  };
  return { listeners, state, api };
});
vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), embla.api],
}));

import { useIsMobile } from '../use-mobile';
import { Carousel, CarouselNext, CarouselPrevious } from '../carousel';

afterEach(cleanup);

function setWidth(w: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
}

function installMatchMedia() {
  const subs = new Set<() => void>();
  window.matchMedia = ((q: string) => ({
    media: q,
    matches: false,
    addEventListener: (_: string, cb: () => void) => subs.add(cb),
    removeEventListener: (_: string, cb: () => void) => subs.delete(cb),
  })) as unknown as typeof window.matchMedia;
  return subs;
}

function Probe() {
  return <output data-testid="m">{String(useIsMobile())}</output>;
}

describe('useIsMobile', () => {
  it('читає ширину на клієнті і реагує на зміну media query', () => {
    setWidth(500);
    const subs = installMatchMedia();
    render(<Probe />);
    expect(screen.getByTestId('m').textContent).toBe('true');
    setWidth(1200);
    act(() => subs.forEach((cb) => cb()));
    expect(screen.getByTestId('m').textContent).toBe('false');
  });

  it('SSR-снапшот детермінований false (без розбіжності гідратації)', () => {
    setWidth(500);
    expect(renderToString(<Probe />)).toContain('false');
  });
});

describe('Carousel: стан прокрутки з Embla', () => {
  it('кнопки відображають canScroll і оновлюються на select; відписка на unmount', () => {
    embla.state.prev = false;
    embla.state.next = true;
    const { unmount } = render(
      <Carousel>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );
    const prev = screen.getByText('Previous slide').closest('button')!;
    const next = screen.getByText('Next slide').closest('button')!;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    embla.state.prev = true;
    embla.state.next = false;
    act(() => embla.listeners.get('select')!.forEach((cb) => cb()));
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    unmount();
    expect(embla.listeners.get('select')!.size).toBe(0);
    expect(embla.listeners.get('reInit')!.size).toBe(0);
  });
});
