import { existsSync } from 'node:fs';
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
 * Відсіює entry-глоби, чиєї теки ще немає на диску.
 *
 * 🔴 tsup кидає `Cannot find …`, якщо глоб не дав жодного файлу, а теки тірів
 * наповнюються поетапно (К0 Task 2–3). Фільтр працює по КАТАЛОГУ (частина
 * шляху до першого `*`), тож він не маскує порожній глоб усередині наявної
 * теки: там збірка чесно впаде.
 */
const present = (patterns: string[]) =>
  patterns.filter((pattern) => existsSync(pattern.split('/*')[0]));

/** Профіль tsup із гарантовано списковим `entry` (потрібен для фільтра нижче). */
type Profile = Options & { entry: string[] };

const profile = (
  name: string,
  entry: string[],
  extra: Partial<Options> = {},
): Profile => ({ ...base, ...extra, name, entry: present(entry) });

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
  // Node/React-тіри (schema, supabase, i18n, ui, admin, теми, плагіни, …):
  // спільні чанки обовʼязкові — модулі зі станом мусять лишатися ОДНИМ
  // інстансом для всіх subpath-entry пакета.
  // Теки тірів додаються сюди в К0 Task 2–3 за знімком exports.
  profile('runtime', ['src/index.ts'], { splitting: true }),
  // Route-шар вітрини: 🔴 `target: esnext` обовʼязковий — за нижчого таргета
  // esbuild лоуерить `import.meta` у `var import_meta = {}`, і опублікований
  // dist падає на `{}.env.VITE_…` ще до першого запиту.
  profile(
    'storefront-routes',
    [
      'src/storefront-routes/index.ts',
      'src/storefront-routes/*.ts',
      'src/storefront-routes/*/*.ts',
      'src/storefront-routes/*/*.tsx',
      'src/storefront-routes/*/*/*.tsx',
    ],
    { splitting: true, target: 'esnext' },
  ),
].filter((item) => item.entry.length > 0);

export default defineConfig(profiles);
