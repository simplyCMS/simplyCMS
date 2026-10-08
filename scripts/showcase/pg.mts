/**
 * Драйвер `pg` для сіду з типами ядра.
 *
 * 🔴 Чому не `import pg from 'pg'`: корінь монорепо має `pg` у залежностях,
 * але не `@types/pg` — типи лежать лише в пакеті ядра. З `scripts/` TS їх не
 * знаходить (TS7016), а ці модулі бачать ДВІ програми: `typecheck:showcase` і
 * кореневий `typecheck` (через гейти харнесу, що їх імпортують). Нову
 * залежність заради сіду не додаємо (Global Constraints), тож тип береться
 * з `@types/pg` ядра (`import type` — стирається в рантаймі), а рантайм — той
 * самий `pg` кореня через `createRequire`.
 */
import { createRequire } from 'node:module';
import type * as PgTypes from '../../packages/simplycms/node_modules/@types/pg/index.d.ts';

export type { PgTypes };

/** Модуль `pg` (CJS-вхід) із типами `@types/pg`. */
export const pg = createRequire(import.meta.url)('pg') as typeof PgTypes;
