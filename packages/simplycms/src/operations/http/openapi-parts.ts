import { z } from 'zod';
import type { OperationDef } from '../define';
import { PROBLEM_STATUS } from './problem-kinds';

type Json = Record<string, unknown>;

/**
 * JSON-схема Zod без вкладеного `$schema`. `Date` у схемі неможливий:
 * `z.toJSONSchema` на ньому кидає — на дроті дата це ISO-рядок (`wireDate`).
 */
export function schemaOf(
  def: OperationDef<unknown, unknown>,
  io: 'input' | 'output',
): Json {
  const schema = z.toJSONSchema(io === 'input' ? def.input : def.output, {
    target: 'draft-2020-12',
    io,
  }) as Json;
  delete schema.$schema;
  return schema;
}

const problemRef = (description: string) => ({
  description,
  content: {
    'application/problem+json': {
      schema: { $ref: '#/components/schemas/Problem' },
    },
  },
});

export function pathItem(def: OperationDef<unknown, unknown>): Json {
  const header = (name: string, description: string, schema: Json) => ({
    name,
    in: 'header',
    required: false,
    description,
    schema,
  });
  const parameters = [
    ...(def.idempotent
      ? [
          header('Idempotency-Key', 'Ключ ідемпотентності (1–255 символів).', {
            type: 'string',
            minLength: 1,
            maxLength: 255,
          }),
        ]
      : []),
    ...(def.versioned
      ? [
          header('If-Match', 'Очікувана версія агрегата: "v<n>".', {
            type: 'string',
            pattern: '^"v\\d+"$',
          }),
        ]
      : []),
  ];
  const content =
    def.transport === 'multipart' ? 'multipart/form-data' : 'application/json';
  return {
    post: {
      operationId: def.id,
      'x-permission': def.permission,
      ...(def.sessionOnly ? { 'x-session-only': true } : {}),
      ...(parameters.length ? { parameters } : {}),
      requestBody: {
        required: true,
        content: { [content]: { schema: schemaOf(def, 'input') } },
      },
      responses: {
        '200': {
          description: 'OK',
          content: { 'application/json': { schema: schemaOf(def, 'output') } },
        },
        '400': problemRef('validation'),
        '401': problemRef('unauthenticated'),
        '403': problemRef('forbidden'),
        '404': problemRef('unknown_operation / not_found'),
        '409': problemRef(
          'conflict / reference / language_in_use / source_changed / idempotency_in_flight',
        ),
        ...(def.versioned ? { '412': problemRef('version_mismatch') } : {}),
        '415': problemRef('unsupported_media_type'),
        ...(def.idempotent
          ? { '422': problemRef('idempotency_mismatch') }
          : {}),
      },
    },
  };
}

/** `components` документа: схема problem+json і способи автентифікації. */
export const COMPONENTS = {
  schemas: {
    Problem: {
      type: 'object',
      required: ['type', 'title', 'status', 'kind', 'operation'],
      properties: {
        type: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'integer' },
        kind: { enum: Object.keys(PROBLEM_STATUS) },
        operation: { type: 'string' },
        detail: { type: 'string' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            required: ['path', 'code'],
            properties: {
              path: {
                type: 'array',
                items: { type: ['string', 'integer'] },
              },
              code: { type: 'string' },
            },
          },
        },
        currentVersion: { type: 'integer' },
        currentSourceHashes: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
        conflicts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'id', 'path'],
            properties: {
              type: { type: 'string' },
              id: { type: 'string' },
              path: { type: 'string' },
            },
          },
        },
      },
    },
  },
  securitySchemes: {
    bearer: { type: 'http', scheme: 'bearer' },
    cookie: {
      type: 'apiKey',
      in: 'cookie',
      name: 'better-auth.session_token',
    },
  },
};
