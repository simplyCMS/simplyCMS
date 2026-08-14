// Якірне редагування simplycms.config.ts (§4.2 спеки): вставка запису
// плагіна/теми + читання вже зареєстрованих ключів. AST-редагування свідомо
// відкладено (§8), тож insertEntry розрізняє рівно три форми рядка-якоря:
// багаторядкову (вставка після якоря), однорядкову порожню («plugins: [],» —
// так pinned prettier згортає порожній блок; розгортаємо в багаторядкову) і
// однорядкову непорожню — чесне падіння (§3), як і відсутність якоря.

/** Якорі — точні рядки з шаблону магазину (template/simplycms.config.ts). */
const ANCHORS = {
  plugin: {
    anchor: 'plugins: [',
    open: '[',
    close: ']',
    label: 'масив plugins',
  },
  theme: { anchor: 'themes: {', open: '{', close: '}', label: 'обʼєкт themes' },
};

/**
 * Ключ запису в конфізі: явний --name або похідний від імені пакета —
 * без scope і без префіксів simplycms-plugin-/simplycms-theme-.
 * @param {string} pkg
 * @param {string} [explicit]
 */
export function deriveKey(pkg, explicit) {
  const raw = explicit ?? stripPrefixes(pkg);
  if (!/^[A-Za-z0-9][\w.-]*$/.test(raw)) {
    throw new Error(
      `Некоректний ключ «${raw}» для simplycms.config.ts — задай явно: --name <key>`,
    );
  }
  return raw;
}

/** @param {string} pkg */
export function stripPrefixes(pkg) {
  const base = pkg.includes('/') ? pkg.slice(pkg.indexOf('/') + 1) : pkg;
  // Обидві конвенції іменування: unscoped `simplycms-plugin-<name>` (спека
  // §13) і scoped `@simplycms/plugin-<name>` (референс-пакети ядра). Без
  // другого strip-а ключ для '@simplycms/plugin-faq' був би 'plugin-faq',
  // що розсинхронився б із manifest.name ('faq') — а на ключі тримаються і
  // рядок у таблиці plugins, і префікс plg_* для лінта міграцій
  // (знахідки рев'ю Фази 3 №1-2).
  return base
    .replace(/^simplycms-(?:plugin|theme)-/, '')
    .replace(/^(?:plugin|theme)-/, '');
}

/** Ідемпотентність add: пакет уже підключено через import('<pkg>'). */
export function hasPackage(source, pkg) {
  return source.includes(`import('${pkg}')`);
}

/**
 * Текст запису (без відступу) для ручної вставки або для вставки за якорем.
 * @param {'plugin' | 'theme'} type
 * @param {string} key
 * @param {string} pkg
 */
export function entryLine(type, key, pkg) {
  return type === 'plugin'
    ? `{ name: '${key}', module: () => import('${pkg}') },`
    : `'${key}': () => import('${pkg}'),`;
}

/**
 * Вставка запису у блок за якорем, з відступом якоря + 2 пробіли.
 * Три гілки за формою рядка-якоря:
 * 1) багаторядкова (блок не закривається на рядку якоря) — запис окремим
 *    рядком одразу після якоря;
 * 2) однорядкова ПОРОЖНЯ («plugins: [],» / «themes: {},») — блок
 *    розгортається в багаторядкову форму зі вставленим записом; сліпа
 *    вставка після якоря тут потрапила б ПОЗА дужки (битий TS, TS1005/TS1136);
 * 3) однорядкова НЕПОРОЖНЯ — безпечної точки вставки немає: виняток.
 * Гілка 3 і «якір не знайдено» — той самий механізм чесного падіння (§3):
 * виняток із точним рядком для ручної вставки; джерело не змінюється
 * (падіння — до будь-якого запису на диск).
 * @param {string} source
 * @param {{ type: 'plugin' | 'theme'; key: string; pkg: string }} input
 * @returns {{ source: string; line: string }}
 */
export function insertEntry(source, { type, key, pkg }) {
  const { anchor, open, close, label } = ANCHORS[type];
  const entry = entryLine(type, key, pkg);
  const manual = `Додай вручну в ${label} рядок:\n  ${entry}`;
  const lines = source.split('\n');
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index === -1) {
    throw new Error(
      `Якір «${anchor}» не знайдено в simplycms.config.ts — файл не змінено.\n${manual}`,
    );
  }
  const line = lines[index];
  const lead = (line.match(/^\s*/) ?? [''])[0];
  const inserted = `${lead}  ${entry}`;
  // Однорядкова форма = блок закривається на самому рядку якоря.
  const block = sliceBlock(line, anchor, open, close);
  if (block === null) {
    // Гілка 1: багаторядковий блок — запис одразу після рядка-якоря.
    lines.splice(index + 1, 0, inserted);
  } else if (block.slice(anchor.length, -1).trim() === '') {
    // Гілка 2: порожній однорядковий блок → багаторядкова форма із записом.
    const start = line.indexOf(anchor);
    lines.splice(
      index,
      1,
      line.slice(0, start) + anchor,
      inserted,
      lead + line.slice(start + block.length - 1),
    );
  } else {
    // Гілка 3: у тих самих дужках уже є вміст — вставку робить людина.
    throw new Error(
      `Якір «${anchor}» — однорядковий непорожній блок у simplycms.config.ts, ` +
        `безпечної точки вставки немає — файл не змінено.\n${manual}`,
    );
  }
  return { source: lines.join('\n'), line: inserted };
}

/**
 * Зріз збалансованого блока від якоря: рахуємо лише дужки виду open/close —
 * у значеннях блоків v1 (стрілки `() => import('…')`) їх немає.
 * @returns {string | null} null — якоря немає (ловить оффлайн-перевірка №10).
 */
function sliceBlock(source, anchor, open, close) {
  const start = source.indexOf(anchor);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Повні записи тем конфігу: ключ + специфікатор import(). Потрібні doctor-у
 * (Фаза 4, Р6): ключ ≠ імʼя пакета через `--name`, а резолвити треба саме
 * специфікатор — теку `@themes/<key>/index` або пакет у node_modules.
 * Дзеркало `configPluginEntries`; null — якір відсутній.
 * @returns {{ key: string; spec: string }[] | null}
 */
export function configThemeEntries(source) {
  const { anchor, open, close } = ANCHORS.theme;
  const block = sliceBlock(source, anchor, open, close);
  if (block === null) return null;
  const entries = block.matchAll(
    /(?:^|\n)\s*'?([\w][\w./-]*)'?\s*:\s*\(\)\s*=>\s*import\('([^']+)'\)/g,
  );
  return [...entries].map((match) => ({ key: match[1], spec: match[2] }));
}

/** Ключі обʼєкта themes конфігу; null — якір відсутній. */
export function configThemeKeys(source) {
  return configThemeEntries(source)?.map((entry) => entry.key) ?? null;
}

/** Імена плагінів із масиву plugins конфігу; null — якір відсутній. */
export function configPluginNames(source) {
  const { anchor, open, close } = ANCHORS.plugin;
  const block = sliceBlock(source, anchor, open, close);
  if (block === null) return null;
  return [...block.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]);
}

/**
 * Повні записи плагінів конфігу: імʼя + специфікатор import(). Потрібні
 * db:diff, щоб знайти теки `migrations/` встановлених плагінів (N канонів,
 * план Фази 3 Р4); null — якір відсутній.
 * @returns {{ name: string; spec: string }[] | null}
 */
export function configPluginEntries(source) {
  const { anchor, open, close } = ANCHORS.plugin;
  const block = sliceBlock(source, anchor, open, close);
  if (block === null) return null;
  const entries = block.matchAll(
    /name:\s*'([^']+)'\s*,\s*module:\s*\(\)\s*=>\s*import\('([^']+)'\)/g,
  );
  return [...entries].map((match) => ({ name: match[1], spec: match[2] }));
}
