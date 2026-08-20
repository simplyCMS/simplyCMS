import { globSync } from 'node:fs';
import { defineConfig, type Options } from 'tsup';

// Флагманський пакет тримає всі тіри T0→T5 в одній теці `src/`, а вимоги до
// esbuild у них РІЗНІ — тому конфіг є масивом профілів, а не одним обʼєктом.
//
// 🔴 `external` обовʼязковий у КОЖНОМУ профілі. Після консолідації
// інтра-пакетні імпорти стають self-reference субшляхами (`simplycms/contracts`
// усередині цього ж пакета). tsup авто-зовнішнить лише те, що є в
// `dependencies`/`peerDependencies`, а пакет не може залежати сам від себе —
// без явного регексу esbuild вбудував би весь граф у кожен entry, і
// stateful-модулі (реєстри, singleton-клієнти) задублювалися б у рантаймі
// МОВЧКИ, без падіння збірки.
const external = [/^simplycms(\/|$)/, /^@simplycms\//];

// 🔴 `clean` тут не вмикається: tsup збирає елементи масиву ПАРАЛЕЛЬНО
// (`Promise.all` у `build()`), і чистка спільного `dist/` одним профілем
// затирала б уже записане іншим. Теку зносить скрипт `build` пакета — один
// раз, до запуску tsup.
const base = {
  format: ['esm'],
  dts: { tsconfig: './tsconfig.json' },
  sourcemap: true,
  treeshake: true,
  clean: false,
  external,
} satisfies Options;

/**
 * Розгортає глоби у мапу entry: `<шлях у dist без розширення> → <файл>`.
 *
 * 🔴 Обʼєктна форма entry обовʼязкова, спискова — ні. За списковою esbuild
 * бере outbase = спільний предок entry-шляхів ПРОФІЛЮ, тож профіль
 * `contracts` (усі entry під `src/contracts/`) писав би `dist/index.js` і
 * затирав корінь пакета. Ключ фіксує вихідний шлях явно й тримає `dist/`
 * дзеркалом `publishConfig.exports`.
 *
 * Порожній результат — не помилка: теки тірів наповнюються поетапно
 * (К0 Task 2–3), профіль без entry просто відсіюється нижче.
 */
const entries = (patterns: string[]): Record<string, string> =>
  Object.fromEntries(
    globSync(patterns)
      .map((file) => file.split('\\').join('/'))
      .filter((file) => !file.includes('__tests__'))
      .sort()
      .map((file) => [
        file.replace(/^src\//, '').replace(/\.tsx?$/, ''),
        `./${file}`,
      ]),
  );

/** Профіль tsup із гарантовано мапним `entry` (потрібен для фільтра нижче). */
type Profile = Options & { entry: Record<string, string> };

const profile = (
  name: string,
  patterns: string[],
  extra: Partial<Options> = {},
): Profile => ({ ...base, ...extra, name, entry: entries(patterns) });

const profiles: Profile[] = [
  // T0-контракти: без code-splitting — кожен entry самодостатній (інакше
  // .d.ts ре-експортує з hash-чанка через .js → ламає moduleResolution:node
  // у споживачів).
  profile(
    'contracts',
    [
      'src/contracts/index.ts',
      'src/contracts/*/index.ts',
      'src/contracts/views/fixtures/index.ts',
    ],
    { splitting: false },
  ),
  // Поверхня плагінів: та сама причина відмови від splitting.
  profile('plugin-sdk', ['src/plugin-sdk/index.ts'], { splitting: false }),
  // Node/React-тіри (domain, schema, supabase, i18n, ui, admin, теми, …):
  // спільні чанки обовʼязкові — модулі зі станом мусять лишатися ОДНИМ
  // інстансом для всіх subpath-entry пакета.
  //
  // 🔴 Патерни ДЗЕРКАЛЯТЬ `exports`, а не «усе, що є в теці»: сусідній модуль
  // без export-входу (`themes/getActiveThemeSSR.ts`, `admin/lib/*`,
  // `storefront-routes/pages/catalog/*`) мусить лишитися чанком, а не стати
  // окремим entry — інакше `dist/` перестає бути дзеркалом exports-мапи.
  profile(
    'core',
    [
      'src/index.ts',
      'src/domain/*.ts',
      'src/schema/schema.ts',
      'src/schema/relations.ts',
      'src/supabase/index.ts',
      'src/supabase/keys.ts',
      'src/supabase/*-client.ts',
      'src/supabase/SupabaseProvider.tsx',
      'src/data-supabase/index.ts',
      'src/react-query/index.ts',
      'src/react-query/queries.ts',
      'src/runtime/index.ts',
      'src/i18n/index.ts',
      'src/storefront/index.ts',
      'src/storefront/*/index.ts',
      'src/ui/*.ts',
      'src/ui/*.tsx',
      'src/themes/index.ts',
      'src/themes/ThemeRegistry.ts',
      'src/themes/ThemeContext.tsx',
      'src/themes/applyTokens.ts',
      'src/themes/safeFontStylesheets.ts',
      'src/themes/bootstrapThemes.ts',
      'src/themes/validateThemeModule.ts',
      'src/themes/conformance/index.ts',
      'src/themes/useThemeT.ts',
      'src/themes/types.ts',
      'src/plugins/index.ts',
      'src/plugins/PluginSlot.tsx',
      'src/plugins/types.ts',
      'src/{cart,catalog,checkout,profile,reviews}-ui/index.ts',
      'src/{cart,catalog,checkout,profile,reviews}-ui/*.tsx',
      'src/admin/index.ts',
      'src/admin/{components,pages,layouts}/*.tsx',
    ],
    { splitting: true },
  ),
  // Route-шар вітрини: 🔴 `target: esnext` обовʼязковий — за нижчого таргета
  // esbuild лоуерить `import.meta` у `var import_meta = {}`, і опублікований
  // dist падає на `{}.env.VITE_…` ще до першого запиту.
  profile(
    'storefront-routes',
    [
      'src/storefront-routes/index.ts',
      'src/storefront-routes/active-theme.ts',
      'src/storefront-routes/server/*.ts',
      'src/storefront-routes/seo/*.ts',
      'src/storefront-routes/pages/*.tsx',
      'src/storefront-routes/components/*.tsx',
      'src/storefront-routes/shells/*.ts',
      'src/storefront-routes/shells/*.tsx',
      'src/storefront-routes/views/*.ts',
      'src/storefront-routes/views/*.tsx',
      'src/storefront-routes/views/slots/*.tsx',
    ],
    { splitting: true, target: 'esnext' },
  ),
].filter((item) => Object.keys(item.entry).length > 0);

export default defineConfig(profiles);
