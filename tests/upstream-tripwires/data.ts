import { readInstalledFile, installedVersion } from '../lib/installed-package';
import {
  buildInsertSql,
  drizzleErrorCause,
  drizzleStillZeroX,
  drizzleWrapsCause,
  insertNamesDefaultedColumns,
  parseSubsetNoOffset,
  shallowError,
  startBody,
  startFnBase,
  startFormBeforeHandler,
  subsetOptionsNotReexported,
  tsEslintPeer,
  type Premise,
} from './premises';

/**
 * Таблиця розтяжок для `upstream-tripwires.test.ts`: ID реєстру → як прочитати
 * встановлений модуль і яка передумова мусить триматися.
 */

export type Tripwire = { read: () => string; premise: Premise }[];

export const SSC = ['@tanstack/react-start', '@tanstack/start-server-core'];
export const HANDLER = 'dist/esm/server-functions-handler.js';

export const TRIPWIRES: Record<string, Tripwire> = {
  'START-BODY-1': [
    { read: () => readInstalledFile(SSC, HANDLER), premise: startBody },
    {
      read: () => readInstalledFile(SSC, 'dist/esm/createServerRpc.js'),
      premise: startFnBase,
    },
  ],
  'START-1': [
    {
      read: () => readInstalledFile(SSC, HANDLER),
      premise: startFormBeforeHandler,
    },
  ],
  'START-2': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/react-start', '@tanstack/router-core'],
          'dist/esm/ssr/serializer/ShallowErrorPlugin.js',
        ),
      premise: shallowError,
    },
  ],
  'TSDB-3': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/query-db-collection', '@tanstack/db'],
          'dist/esm/query/expression-helpers.js',
        ),
      premise: parseSubsetNoOffset,
    },
  ],
  'TSDB-4': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/query-db-collection'],
          'dist/esm/index.d.ts',
        ),
      premise: subsetOptionsNotReexported,
    },
  ],
  'DRZ-1': [
    {
      read: () => readInstalledFile(['drizzle-orm'], 'pg-core/session.js'),
      premise: drizzleWrapsCause,
    },
    {
      read: () => readInstalledFile(['drizzle-orm'], 'errors.js'),
      premise: drizzleErrorCause,
    },
  ],
  'DRZ-INSERT-1': [
    { read: buildInsertSql, premise: insertNamesDefaultedColumns },
  ],
  'TSESL-1': [
    {
      read: () => readInstalledFile(['typescript-eslint'], 'package.json'),
      premise: tsEslintPeer,
    },
  ],
  'DRIZ-1': [
    {
      read: () => installedVersion(['drizzle-orm']),
      premise: drizzleStillZeroX,
    },
  ],
};
