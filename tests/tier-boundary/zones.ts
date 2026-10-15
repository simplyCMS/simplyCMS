// Таблиця очікувань тір-зон (ПК3, трек К0) — окремо від асертів, щоб обидва
// файли лишались у межах 150 рядків.
//
// 🔴 Очікування задані РУКАМИ: тест не має переказувати ту саму структуру, з
// якої зібраний конфіг (`eslint.tier-zones.mjs`).

/** [тека зони, заборонений специфікатор, легальний специфікатор] */
export const ZONES: ReadonlyArray<readonly [string, string, string]> = [
  ['packages/simplycms/src/contracts', 'simplycms/domain/pricing', 'react'],
  ['packages/simplycms/src/domain', 'simplycms/schema', 'simplycms/contracts'],
  ['packages/simplycms/src/schema', 'simplycms/db', 'simplycms/contracts'],
  ['packages/simplycms/src/db', 'simplycms/react-query', 'simplycms/schema'],
  ['packages/simplycms/src/auth', 'simplycms/react-query', 'simplycms/db'],
  [
    'packages/simplycms/src/react-query',
    'simplycms/db',
    'simplycms/domain/money',
  ],
  [
    'packages/simplycms/src/runtime',
    'simplycms/ui/button',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/i18n',
    'simplycms/react-query',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/storefront',
    'simplycms/react-query',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/admin-server',
    'simplycms/storefront/loaders',
    'simplycms/db',
  ],
  // Порт сховища (Е2) — T2 з upward-винятком лише на `db`; `react-query`
  // того самого тіру у виняток НЕ входить, тож ловиться.
  [
    'packages/simplycms/src/storage',
    'simplycms/react-query',
    'simplycms/domain/media',
  ],
  // Облік залишків (Е3-5) — T2 з upward-винятком лише на `db`; імпорт назад
  // у вітрину (звідки модуль перенесено) — рівно та заборона, яку рішення
  // Е3-5 мало закрити.
  [
    'packages/simplycms/src/inventory',
    'simplycms/storefront/loaders',
    'simplycms/db',
  ],
  // Ціноутворення й доставка (Е5б-5) — T2 з upward-винятком лише на `db`;
  // імпорт назад у вітрину (звідки рушій перенесено) — рівно та заборона,
  // яку рішення Е5б-5 мало закрити.
  [
    'packages/simplycms/src/commerce',
    'simplycms/storefront/loaders',
    'simplycms/db',
  ],
  // Резолвер груп env (Е8-Р7) — T2 без жодних upward-винятків: чиста функція
  // над переданим оточенням, `db` їй ні до чого — тож ловиться навіть він.
  ['packages/simplycms/src/env', 'simplycms/db', 'simplycms/contracts'],
  // Охорона серверного входу (Е8, Р23/Р27) — T2, upward лише `env`: до БД їй
  // діла нема, тож ловиться `db`.
  [
    'packages/simplycms/src/server-guard',
    'simplycms/db',
    'simplycms/contracts',
  ],
  // Build-time плагіни Vite (Е8) — T2 без upward-винятків: Node-код збірки,
  // `db` йому ні до чого — тож ловиться навіть він.
  ['packages/simplycms/src/vite', 'simplycms/db', 'simplycms/contracts'],
  // Накат міграцій (Е8-Р2) — T2 без upward-винятків: `db` (withActor) йому
  // не потрібен, тож ловиться навіть він.
  ['packages/simplycms/src/migrate', 'simplycms/db', 'simplycms/contracts'],
  // Прод-старт (К3-Е8, F5) — T2, upward лише `env` і `migrate`: `db` (withActor)
  // старту не потрібен, тож ловиться.
  ['packages/simplycms/src/prod-start', 'simplycms/db', 'simplycms/migrate'],
  // Пошта (Е8, Task 10/12) — T2, upward `env`, `db`, `schema`, `i18n`; `auth`
  // кличе її, а не навпаки, тож зворотний імпорт ловиться (цикл auth ↔ mail).
  ['packages/simplycms/src/mail', 'simplycms/auth', 'simplycms/db'],
  // Кеш профілю й вшиті теми (Е6б-7; Е8 додав upward `i18n`) — T2, upward
  // `db`, `i18n`; `auth` того ж тіру — поза винятком.
  ['packages/simplycms/src/site', 'simplycms/auth', 'simplycms/i18n'],
  ['packages/simplycms/src/ui', 'simplycms/react-query', 'simplycms/ui/utils'],
  [
    'packages/simplycms/src/themes',
    'simplycms/admin/pages/Themes',
    'simplycms/react-query',
  ],
  [
    'packages/simplycms/src/plugins',
    'simplycms/plugin-sdk',
    'simplycms/contracts/semver',
  ],
  [
    'packages/simplycms/src/admin-data',
    'simplycms/admin',
    'simplycms/contracts',
  ],
  [
    'packages/simplycms/src/plugin-sdk',
    'simplycms/admin',
    'simplycms/plugins/types',
  ],
  [
    'packages/simplycms/src/cart-ui',
    'simplycms/core/hooks/useCart',
    'simplycms/react-query',
  ],
  [
    'packages/simplycms/src/catalog-ui',
    'simplycms/storefront-routes/pages/Catalog',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/checkout-ui',
    'simplycms/admin',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/profile-ui',
    'simplycms/storefront-routes/pages/Profile',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/reviews-ui',
    'simplycms/admin',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/src/core',
    'simplycms/storefront-routes/pages/Home',
    'simplycms/themes/ThemeContext',
  ],
  [
    'packages/simplycms/src/admin',
    'simplycms/storefront-routes/pages/Home',
    'simplycms/core/hooks/use-toast',
  ],
  [
    'packages/simplycms/src/storefront-routes',
    'simplycms/admin/pages/Products',
    'simplycms/core/hooks/useAuth',
  ],
  [
    'packages/simplycms/routes/storefront',
    'simplycms/admin/pages/Products',
    'simplycms/storefront-routes/pages/Home',
  ],
  [
    'packages/simplycms/routes/admin',
    'simplycms/core/hooks/useAuth',
    'simplycms/admin/pages/Products',
  ],
];

/**
 * Дзеркало bare-специфікатора у ВІДНОСНУ форму — рівно те, чим той самий
 * крос-тірний імпорт виглядає після злиття тек в один пакет. Перетворюється
 * лише СИНТАКСИС; що саме заборонено, лишається заданим руками в `ZONES`.
 * `routes/*` лежить на рівень вище `src/`, тож у нього своя форма.
 */
export function toRelativeForms(dir: string, specifier: string): string[] {
  const tail = specifier.replace(/^simplycms\//, '');
  // 🔴 Форм на ту саму ціль дві, і обидві мусять ловитись: коротка — через
  // теку-контейнер тіру (`src`), довша — через корінь пакета. Друга вилізла
  // ревʼю К0 (коло 2): гард закривав лише першу. Для зон під `routes/` обидві
  // збігаються в один рядок, тому набір дедуплікується.
  const forms = dir.startsWith('packages/simplycms/routes/')
    ? [`../../src/${tail}`]
    : [`../${tail}`, `../../src/${tail}`];
  return [...new Set(forms)];
}

/**
 * Відносні імпорти, які МУСЯТЬ лишатись чистими: своя тека через `../`
 * (легальний вихід-і-назад усередині тіру), нижчий шар і зафіксовані
 * винятки статус-кво. Саме тут би вилізла надто широка група патернів.
 */
export const LEGAL_RELATIVE: ReadonlyArray<readonly [string, string]> = [
  ['packages/simplycms/src/cart-ui', '../cart-ui/CartSummary'],
  ['packages/simplycms/src/ui', '../ui/button'],
  ['packages/simplycms/src/admin', '../admin/components/ImageUpload'],
  ['packages/simplycms/src/admin', '../../admin/pages/Products'],
  ['packages/simplycms/src/admin', './components/ImageUpload'],
  ['packages/simplycms/src/react-query', '../domain/money'],
  ['packages/simplycms/src/storefront-routes', '../core/hooks/useAuth'],
  ['packages/simplycms/routes/admin', '../../src/admin/pages/Products'],
];

/**
 * Контрольна точка ПОЗА всіма тір-зонами: host-код магазину. Той самий
 * синтетичний імпорт тут має бути чистим — інакше зона не зона, а глобальна
 * заборона.
 */
export const OUTSIDE = 'src/__tier-fixture.ts';
