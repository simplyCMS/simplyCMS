/**
 * Р23, уточнення архітектора: доменні помилки з кодами проходять крізь
 * глобальну function-middleware НЕ маскованими, а непередбачені — маскуються.
 * Тест на ОБИДВА випадки з СПРАВЖНІМИ класами ядра й справжнім адаптером
 * серіалізації (те, що летить на клієнт: `name`, поля, статус).
 */
import { fromCrossJSON, toCrossJSONAsync, toCrossJSONStream } from 'seroval';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { domainErrorAdapter } from 'simplycms/runtime/domain-error-adapter';
import { AuthzError } from 'simplycms/auth';
import {
  ADMIN_STATE_CONSTRAINT,
  stateConflict,
} from 'simplycms/contracts/domain-errors';
import { maskAround } from 'simplycms/server-guard';
import { startInstance } from '../src/start';

afterEach(() => vi.unstubAllEnvs());

/** Прогін тіла міддлвари: `next` кидає задану помилку, як Start після падіння обробника. */
async function through(error: unknown): Promise<unknown> {
  try {
    await maskAround(() => Promise.reject(error));
  } catch (thrown) {
    return thrown;
  }
  throw new Error('міддлвара не кинула помилку');
}

// `@tanstack/router-core` — залежність пакета `simplycms`, з кореня монорепо
// (pnpm) прямо не резолвиться: беремо той самий екземпляр, що й Start.
const requireFromPackage = createRequire(
  createRequire(import.meta.url).resolve('simplycms/runtime'),
);
const { defaultSerovalPlugins, makeSerovalPlugin } = (await import(
  requireFromPackage.resolve('@tanstack/router-core/ssr/client')
)) as {
  defaultSerovalPlugins: readonly unknown[];
  makeSerovalPlugin: (adapter: unknown) => unknown;
};
const { makeSsrSerovalPlugin } = (await import(
  requireFromPackage.resolve('@tanstack/router-core/ssr/server')
)) as { makeSsrSerovalPlugin: (adapter: unknown) => unknown };

type Plugins = NonNullable<
  NonNullable<Parameters<typeof toCrossJSONAsync>[1]>['plugins']
>;

// Той самий порядок, що в Start: адаптери застосунку, далі плагіни router-core
// (серед них `ShallowErrorPlugin`, що несе лише `message`).
const plugins = [
  makeSerovalPlugin(domainErrorAdapter),
  ...defaultSerovalPlugins,
] as unknown as Plugins;

/** Те, що клієнт побачить після справжньої серіалізації Start. */
async function overTheWire(error: unknown): Promise<Error> {
  const node = await toCrossJSONAsync(error, { plugins });
  return fromCrossJSON<Error>(node, { plugins, refs: new Map() });
}

describe('global function-middleware: Р23 у проді', () => {
  it('AuthzError проходить: name і operation на місці', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const thrown = await through(new AuthzError('orders.manage' as never));
    const received = (await overTheWire(thrown)) as Error & {
      operation: string;
    };

    expect(received.name).toBe('AuthzError');
    expect(received.operation).toBe('orders.manage');
  });

  it('stateConflict проходить: kind і constraint на місці', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    let conflict: unknown;
    try {
      stateConflict(ADMIN_STATE_CONSTRAINT.orderCancelledFinal);
    } catch (error) {
      conflict = error;
    }
    const received = (await overTheWire(await through(conflict))) as Error & {
      kind: string;
      constraint: string;
    };

    expect(received.name).toBe('AdminConflictError');
    expect(received.kind).toBe('state');
    expect(received.constraint).toBe('order_cancelled_final');
  });

  it('непередбачена помилка — загальний текст з ідентифікатором, без SQL', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const received = await overTheWire(
      await through(new Error('Failed query: select 1\nparams: x')),
    );

    expect(received.message).toMatch(
      /^Internal server error \[ref [a-z0-9]+\]$/,
    );
    expect(received.message).not.toContain('Failed query');
    expect(String(log.mock.calls[0]?.[0])).toContain('Failed query');
    log.mockRestore();
  });

  it('поза продом непередбачена помилка не маскується', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const error = new Error('Failed query: select 1');
    expect(await through(error)).toBe(error);
  });
});

/**
 * I1: дегідратація SSR. Той самий порядок плагінів, що в router-core
 * (`ssr-server.js`): адаптери застосунку (доменний, потім маскувальний) через
 * `makeSsrSerovalPlugin` ПЕРЕД плагінами за замовчуванням (там
 * `ShallowErrorPlugin`). Серіалізуємо стан збійного матчу так, як це робить
 * дегідратація: помилка лежить у полі матчу, поза будь-якою server function.
 */
describe('дегідратація SSR: помилка лоадера поза server function (I1)', async () => {
  // Адаптери беремо з РЕАЛЬНОЇ реєстрації `createStart` у `src/start.ts`: тест
  // червоніє, якщо маскувальний адаптер там не зареєстровано.
  const registered =
    (await startInstance.getOptions()).serializationAdapters ?? [];
  const ssrPlugins = [
    ...registered.map((adapter) => makeSsrSerovalPlugin(adapter)),
    ...defaultSerovalPlugins,
  ] as unknown as Plugins;

  /** Увесь JSON, який дегідратація віддала б у HTML-потік. */
  function dehydrate(error: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      toCrossJSONStream(
        { matches: [{ id: 'm', status: 'error', e: error }] },
        {
          plugins: ssrPlugins,
          onParse: (node) => chunks.push(JSON.stringify(node)),
          onDone: () => resolve(chunks.join('\n')),
          onError: reject,
        },
      );
    });
  }

  it('прод: у payload немає тексту помилки, є [ref <id>], той самий id у лозі', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = await dehydrate(
      new Error('Failed query: select "id" from "x"\nparams: secret'),
    );

    expect(payload).not.toMatch(/Failed query|select|params|secret/);
    const ref = /Internal server error \[ref ([a-z0-9]+)\]/.exec(payload)?.[1];
    expect(ref).toBeTruthy();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain(ref);
    expect(String(log.mock.calls[0]?.[0])).toContain('Failed query');
    log.mockRestore();
  });

  it('доменна помилка з лоадера проходить з полями', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const payload = await dehydrate(new AuthzError('orders.manage' as never));

    expect(payload).toContain('AuthzError');
    expect(payload).toContain('orders.manage');
    expect(payload).not.toContain('Internal server error');
  });

  it('поза продом текст лишається як є', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(await dehydrate(new Error('Failed query: select 1'))).toContain(
      'Failed query',
    );
  });
});
