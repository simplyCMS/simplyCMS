/**
 * Нормалізація специфікаторів і класифікація зовнішніх залежностей
 * (`peerDependencies` проти `dependencies`) для audit-deps.
 */

import { builtinModules } from 'node:module';

const BUILTINS = new Set(builtinModules);

/**
 * Пакети, яких у застосунку має бути РІВНО ОДИН інстанс: React (hooks/контекст),
 * TanStack Router/Start (реєстр роутів, SSR-контекст), TanStack Query
 * (QueryClient-контекст), Supabase (auth-стан і сховище сесії). Дубль такого
 * пакета в дереві `node_modules` — це «Invalid hook call»/дві сесії, тому
 * ядро оголошує їх peer-ами, а версію фіксує host.
 */
const PEER_PACKAGES = new Set([
  'react',
  'react-dom',
  '@tanstack/react-router',
  '@tanstack/react-start',
  '@tanstack/react-query',
]);

const PEER_SCOPES = ['@supabase/'];

/**
 * Специфікатор → імʼя npm-пакета.
 * Відносні/абсолютні шляхи, `node:*` і вбудовані модулі → `null`.
 * @param {string} specifier
 * @returns {string | null}
 */
export function toPackageName(specifier) {
  if (!specifier) return null;
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('node:')) return null;
  if (BUILTINS.has(specifier)) return null;

  const segments = specifier.split('/');
  const name = specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
  // `@scope` без імені пакета — не валідний специфікатор.
  if (name.startsWith('@') && segments.length < 2) return null;
  return name;
}

/**
 * Куди має потрапити зовнішній пакет.
 * @param {string} name
 * @returns {'peerDependencies' | 'dependencies'}
 */
export function classifyExternal(name) {
  if (PEER_PACKAGES.has(name)) return 'peerDependencies';
  if (PEER_SCOPES.some((scope) => name.startsWith(scope)))
    return 'peerDependencies';
  return 'dependencies';
}
