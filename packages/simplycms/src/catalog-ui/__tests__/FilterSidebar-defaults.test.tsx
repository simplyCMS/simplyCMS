// @vitest-environment jsdom
import { Component, Profiler, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { FilterSidebar } from '../FilterSidebar';

vi.mock('simplycms/core/lib/section-filters', () => ({
  getSectionFilters: vi.fn(async () => ({
    properties: [],
    optionsByProperty: {},
  })),
}));

afterEach(() => vi.restoreAllMocks());

/** Зациклення React перетворює на кинуту помилку («Too many re-renders»). */
class Catch extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <p data-testid="crash">{this.state.error}</p>
    ) : (
      this.props.children
    );
  }
}

describe('FilterSidebar — default-пропси', () => {
  it('без numericPropertyRanges і products не зациклюється', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let renders = 0;
    // Profiler рахує коміти САМОЇ панелі (обгортка не перерендерується).
    const Probe = () => (
      <Profiler id="sidebar" onRender={() => (renders += 1)}>
        <FilterSidebar
          sectionId="sec-1"
          filters={{}}
          onFilterChange={() => {}}
        />
      </Profiler>
    );
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <I18nProvider locale="uk">
          <Catch>
            <Probe />
          </Catch>
        </I18nProvider>
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 100));
    const messages = errors.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('Maximum update depth'))).toBe(
      false,
    );
    expect(screen.queryByTestId('crash')).toBeNull();
    expect(renders).toBeLessThan(10);
  });
});
