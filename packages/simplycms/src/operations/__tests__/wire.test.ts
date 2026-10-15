// Дротова форма дат: Date ↔ ISO-рядок на межі, не в операціях.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineOperation, wireDate } from '..';
import { toWire } from '../http/wire';
import { buildOpenApi } from '../http/openapi';

describe('wire', () => {
  it('вихід із Date серіалізується в ISO-рядок', () => {
    const out = toWire({
      at: new Date('2026-01-02T03:04:05.000Z'),
      nested: [{ d: new Date(0) }],
    });
    expect(out).toEqual({
      at: '2026-01-02T03:04:05.000Z',
      nested: [{ d: '1970-01-01T00:00:00.000Z' }],
    });
  });

  it('вхід з ISO-рядком стає Date у run', async () => {
    let seen: unknown;
    const op = defineOperation({
      id: 'test.wire',
      permission: 'settings.manage',
      input: z.object({ at: wireDate }),
      output: z.object({ ok: z.boolean() }),
      async run(_ctx, input) {
        seen = input.at;
        return { ok: true };
      },
    });
    const parsed = op.input.parse({ at: '2026-01-02T03:04:05.000Z' });
    await op.run({} as never, parsed);
    expect(seen).toBeInstanceOf(Date);
    expect((seen as Date).toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });

  it('wireDate у схемі входу — string/date-time в OpenAPI', () => {
    const op = defineOperation({
      id: 'test.wire',
      permission: 'settings.manage',
      input: z.object({ at: wireDate }),
      output: z.object({}),
      async run() {
        return {};
      },
    });
    const doc = buildOpenApi([op as never]) as { paths: Record<string, never> };
    expect(JSON.stringify(doc.paths)).toContain('"format":"date-time"');
  });

  it('Date у схемі операції заборонений: OpenAPI не будується', () => {
    const op = defineOperation({
      id: 'test.date',
      permission: 'settings.manage',
      input: z.object({ at: z.date() }),
      output: z.object({}),
      async run() {
        return {};
      },
    });
    expect(() => buildOpenApi([op as never])).toThrow(/Date/);
  });
});
