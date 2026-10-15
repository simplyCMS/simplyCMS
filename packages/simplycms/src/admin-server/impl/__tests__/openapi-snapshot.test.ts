// Д1: закомічений знімок OpenAPI операцій ядра. Будь-яка зміна публічного
// контракту (вхід, вихід, права, прапорці) видна в дифі рев'ю. Регенерація:
// `pnpm api:snapshot` (UPDATE_API_SNAPSHOT=1).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApi } from 'simplycms/operations/server';
import { CORE_OPERATIONS } from '..';

const SNAPSHOT = resolve(
  import.meta.dirname,
  '../../../../api/openapi.core.json',
);
const doc = buildOpenApi(CORE_OPERATIONS);

if (process.env.UPDATE_API_SNAPSHOT === '1')
  writeFileSync(SNAPSHOT, `${JSON.stringify(doc, null, 2)}\n`);

describe('OpenAPI ядра', () => {
  it('збігається із закоміченим знімком api/openapi.core.json', () => {
    expect(JSON.parse(readFileSync(SNAPSHOT, 'utf8'))).toEqual(doc);
  });

  it('валідний 3.1 за структурою', () => {
    const d = doc as {
      openapi: string;
      paths: Record<
        string,
        {
          post?: { requestBody?: unknown; responses?: Record<string, unknown> };
        }
      >;
    };
    expect(d.openapi).toBe('3.1.0');
    const add = d.paths['/api/v1/languages.add']?.post;
    expect(add?.requestBody).toBeDefined();
    expect(Object.keys(add?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '401', '403', '409', '422']),
    );
    // Кожна операція реєстру — окремий шлях; вкладених `$schema` немає.
    expect(Object.keys(d.paths)).toHaveLength(CORE_OPERATIONS.length);
    expect(JSON.stringify(doc)).not.toContain('"$schema"');
  });

  it('idempotent → заголовок Idempotency-Key, sessionOnly → x-session-only', () => {
    const d = doc as {
      paths: Record<string, { post: Record<string, unknown> }>;
    };
    expect(
      JSON.stringify(d.paths['/api/v1/languages.add']!.post.parameters),
    ).toContain('Idempotency-Key');
    expect(d.paths['/api/v1/api-tokens.create']!.post['x-session-only']).toBe(
      true,
    );
    expect(
      d.paths['/api/v1/languages.list']!.post['x-session-only'],
    ).toBeUndefined();
  });
});
