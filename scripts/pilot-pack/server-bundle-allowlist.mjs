/**
 * Allowlist Gate SB: пакети з `node_modules`, яким ДОЗВОЛЕНО бути вклеєними в серверний
 * бандл скретч-магазину, і причина. Розвʼязує клас дефекту `UPSTREAM:START-IP-1`: вклеєний
 * CJS-пакет із dual-`exports`, до якого йде `require()`, береться за умовою `import`.
 * Безпечні лише: ESM-only; CJS без ESM-входу; dual, до якого йдуть тільки ESM-імпорти або
 * `require()` з іменованою деструктуризацією, спільною для обох входів.
 *
 * 🔴 Список лише СКОРОЧУЄТЬСЯ: новий пакет у бандлі червонить гейт (або робимо його external —
 * пряма залежність/peer, як `pg`, — або додаємо запис із перевіреною причиною); запис, якого
 * в бандлі вже немає, теж червонить. Забороненим (`FORBIDDEN_BUNDLED`) тут бути не можна.
 */
export const SERVER_BUNDLE_ALLOWLIST = {
  '@better-auth/core': 'ESM-only (type=module, без require-шляху)',
  '@better-auth/drizzle-adapter': 'ESM-only',
  '@better-auth/kysely-adapter': 'ESM-only',
  '@better-auth/memory-adapter': 'ESM-only',
  '@better-auth/telemetry': 'ESM-only',
  '@better-auth/utils':
    'dual (exports import/require), але досягається лише ESM-імпортами better-auth/core — require() до нього в бандлі немає',
  '@better-fetch/fetch': 'dual, лише ESM-імпорти (better-auth)',
  '@noble/ciphers': 'ESM-only',
  '@noble/hashes': 'ESM-only',
  '@opentelemetry/semantic-conventions':
    'CJS без ESM-входу в exports; ESM-імпорти беруть його як є',
  '@simplycms/plugin-faq':
    'ESM-only; плагін — частина збірки магазину, noExternal Start (peer на react-start)',
  '@tanstack/history': 'dual, лише ESM-імпорти (router-core)',
  '@tanstack/react-start': 'ESM-only; noExternal Start',
  '@tanstack/react-start-server': 'ESM-only; noExternal Start',
  '@tanstack/router-core': 'dual, лише ESM-імпорти TanStack',
  '@tanstack/start-client-core': 'ESM-only; noExternal Start',
  '@tanstack/start-server-core': 'ESM-only; noExternal Start',
  '@tanstack/start-storage-context': 'ESM-only; noExternal Start',
  aws4fetch:
    'dual (exports import/require, без type); у бандл береться ESM-вхід dist/aws4fetch.esm.mjs через ESM-імпорт s3-драйвера ядра — require() до нього в бандлі немає, залежностей у пакета нема (перевірено на бандлі скретча 2026-10-12)',
  'better-auth': 'ESM-only; noExternal Start (peer на react-start)',
  'better-call': 'dual, лише ESM-імпорти better-auth',
  'cookie-es': 'ESM-only',
  dayjs:
    'CJS без exports: єдиний (CJS) вхід, нема ESM-варіанта для хибного вибору',
  defu: 'dual, лише ESM-імпорти (h3/better-auth); require() у бандлі немає',
  'dom-serializer': 'ESM-only',
  domelementtype: 'ESM-only',
  domhandler: 'ESM-only',
  domutils: 'ESM-only',
  entities: 'ESM-only',
  'escape-string-regexp': 'CJS без exports: єдиний вхід',
  h3: 'ESM-only',
  htmlparser2:
    'ESM-only; require() з sanitize-html виходить на єдиний (ESM) вхід',
  'is-plain-object':
    'dual; require() з sanitize-html бере лише іменований `isPlainObject`, наявний в обох входах (перевірено на бандлі 2026-10-11)',
  jose: 'ESM-only',
  kysely: 'ESM-only',
  launder: 'CJS без exports: єдиний вхід',
  nanoid:
    'dual (3.x); require() із sanitize-html бере лише іменований `nanoid`, наявний в обох входах (перевірено на бандлі 2026-10-11)',
  nanostores: 'ESM-only',
  'parse-srcset': 'CJS без exports: єдиний вхід',
  picocolors: 'CJS без exports: єдиний вхід',
  postcss:
    'dual; require() із sanitize-html бере лише іменований `parse`, наявний в обох входах (перевірено на бандлі 2026-10-11)',
  rou3: 'ESM-only',
  'sanitize-html':
    'CJS без exports: єдиний вхід; пряма залежність ядра (вклеєна, бо транзитивна для магазину) — не драйвер і не dual',
  seroval: 'dual, лише ESM-імпорти TanStack',
  'seroval-plugins': 'dual, лише ESM-імпорти TanStack',
  simplycms: 'ESM-only (dist); ядро — noExternal Start (peer на react-start)',
  'source-map-js': 'CJS без exports: єдиний вхід',
  srvx: 'ESM-only',
};
