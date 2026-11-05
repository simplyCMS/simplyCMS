import { createServerEntry } from '@tanstack/react-start/server-entry';
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
  startEntryHttpErrorStatus,
  startEntrySwallowsThrow,
  startFnBase,
  startFormBeforeHandler,
  startHandlerType,
  startImportProtectionNoKind,
  startUnknownFnBeforeTry,
  startUnknownFnResolverThrows,
  subsetOptionsNotReexported,
  tsEslintPeer,
  type BehaviorPremise,
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
    {
      read: () => readInstalledFile(SSC, 'dist/esm/createStartHandler.js'),
      premise: startHandlerType,
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
  'START-SFN-404-1': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/react-start', '@tanstack/start-plugin-core'],
          'dist/esm/start-compiler/server-fn-resolver-module.js',
        ),
      premise: startUnknownFnResolverThrows,
    },
    {
      read: () => readInstalledFile(SSC, HANDLER),
      premise: startUnknownFnBeforeTry,
    },
  ],
  'START-IP-1': [
    {
      read: () =>
        readInstalledFile(
          ['@tanstack/react-start', '@tanstack/start-plugin-core'],
          'dist/esm/vite/import-protection-plugin/plugin.js',
        ),
      premise: startImportProtectionNoKind,
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

/**
 * Поведінкові розтяжки: виконують бібліотеку (текстом `dist` це не прочитати —
 * обгортка винятку живе в runtime). ID — ті самі активні записи реєстру.
 */
export const BEHAVIORAL_TRIPWIRES: Record<string, BehaviorPremise[]> = {
  'START-ENTRY-1': [
    startEntrySwallowsThrow(createServerEntry),
    startEntryHttpErrorStatus(createServerEntry),
  ],
};
