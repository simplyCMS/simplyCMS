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
 *
 * Окремо — пакети з модульним singleton-станом ПОЗА React-контекстом; дубль
 * тут не падає, а мовчки нічого не робить:
 *  - `sonner` тримає чергу тостів у module-scope `Observer` → `toast()` з
 *    другої копії не доходить до `<Toaster>` з першої;
 *  - `react-hook-form` — `FormProvider`/`useFormContext` через module-scope
 *    контекст → `useForm()` з другої копії не бачить `<Form>` з першої;
 *  - `next-themes` — те саме з `ThemeProvider`.
 */
const PEER_PACKAGES = new Set([
  'react',
  'react-dom',
  '@tanstack/react-router',
  '@tanstack/react-start',
  '@tanstack/react-query',
  'sonner',
  'react-hook-form',
  'next-themes',
]);

const PEER_SCOPES = ['@supabase/'];

const EMPTY_PEERS = new Set();

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
 * Обʼєднання зовнішніх `peerDependencies`, уже оголошених пакетами ядра.
 *
 * Peer-множина виводиться з ДАНИХ, а не зі списку: якщо пакет комусь із ядра
 * peer, а комусь `dependencies` — у дереві споживача опиняться дві копії того
 * самого модуля. Для чогось stateless це лише зайві кілобайти, для решти —
 * два незалежні singleton-и й тихо неробочий UI.
 *
 * @param {Map<string, { peerDependencies?: Record<string, string> }>} packages
 * @returns {Set<string>}
 */
export function collectDeclaredPeers(packages) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const info of packages.values()) {
    for (const name of Object.keys(info.peerDependencies ?? {})) {
      if (packages.has(name)) continue; // сиблінг ядра — не зовнішній peer
      names.add(name);
    }
  }
  return names;
}

/**
 * Куди має потрапити зовнішній пакет.
 * @param {string} name
 * @param {Set<string>} [declaredPeers] результат `collectDeclaredPeers`
 * @returns {'peerDependencies' | 'dependencies'}
 */
export function classifyExternal(name, declaredPeers = EMPTY_PEERS) {
  if (PEER_PACKAGES.has(name)) return 'peerDependencies';
  if (declaredPeers.has(name)) return 'peerDependencies';
  if (PEER_SCOPES.some((scope) => name.startsWith(scope)))
    return 'peerDependencies';
  return 'dependencies';
}

/**
 * Діапазон, який ядро має поставити в manifest замість host-піна.
 *
 * Пріоритет — діапазон, який для цього ж пакета вже одностайно оголосили інші
 * пакети ядра (щоб партії не розʼїжджались). Інакше — caret-мажор host-піна:
 * точний пін в опублікованому manifest-і запирає магазин на версії ядра й дає
 * `ERESOLVE` на `npm install`, щойно host оновиться.
 *
 * @param {string} name
 * @param {Map<string, { dependencies?: Record<string,string>; peerDependencies?: Record<string,string> }>} packages
 * @param {Record<string, string>} rootVersions
 * @returns {string | null}
 */
export function proposeRange(name, packages, rootVersions) {
  /** @type {Set<string>} */
  const declared = new Set();
  for (const info of packages.values()) {
    const spec = info.dependencies?.[name] ?? info.peerDependencies?.[name];
    if (typeof spec === 'string' && !spec.startsWith('workspace:'))
      declared.add(spec);
  }
  // Кілька різних діапазонів — узгоджувати їх має людина, не скрипт.
  if (declared.size === 1) return [...declared][0];

  return caretMajor(rootVersions[name] ?? null);
}

/**
 * Точний пін → caret-мажор (`1.168.23` → `^1.0.0`).
 * Для `0.x` мажором за semver є мінор, тож звужувати до `^0.0.0` не можна.
 * Усе, що вже не схоже на пін (`>=0.400.0`, `^3 || ^4`), повертається як є.
 * @param {string | null} spec
 * @returns {string | null}
 */
export function caretMajor(spec) {
  if (typeof spec !== 'string') return null;
  const match = /^[~^]?(\d+)\.(\d+)\.\d+[\w.+-]*$/.exec(spec.trim());
  if (!match) return spec;
  return match[1] === '0' ? `^0.${match[2]}.0` : `^${match[1]}.0.0`;
}
