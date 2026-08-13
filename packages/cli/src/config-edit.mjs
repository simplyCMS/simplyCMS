// Якірне редагування simplycms.config.ts (§4.2 спеки): вставка запису
// плагіна/теми + читання вже зареєстрованих ключів. AST-редагування свідомо
// відкладено (§8) — якір не знайдено means чесне падіння, а не вгадування.

/** Якорі — точні рядки з шаблону магазину (template/simplycms.config.ts). */
const ANCHORS = {
  plugin: { anchor: 'plugins: [', label: 'масив plugins' },
  theme: { anchor: 'themes: {', label: 'обʼєкт themes' },
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
function stripPrefixes(pkg) {
  const base = pkg.includes('/') ? pkg.slice(pkg.indexOf('/') + 1) : pkg;
  return base.replace(/^simplycms-(?:plugin|theme)-/, '');
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
 * Вставка запису одразу після рядка-якоря, з відступом якоря + 2 пробіли.
 * Якір не знайдено — виняток із точним рядком для ручної вставки; джерело
 * не змінюється (падіння — до будь-якого запису на диск).
 * @param {string} source
 * @param {{ type: 'plugin' | 'theme'; key: string; pkg: string }} input
 * @returns {{ source: string; line: string }}
 */
export function insertEntry(source, { type, key, pkg }) {
  const { anchor, label } = ANCHORS[type];
  const entry = entryLine(type, key, pkg);
  const lines = source.split('\n');
  const index = lines.findIndex((line) => line.includes(anchor));
  if (index === -1) {
    throw new Error(
      `Якір «${anchor}» не знайдено в simplycms.config.ts — файл не змінено.\n` +
        `Додай вручну в ${label} рядок:\n  ${entry}`,
    );
  }
  const indent = `${(lines[index].match(/^\s*/) ?? [''])[0]}  `;
  lines.splice(index + 1, 0, indent + entry);
  return { source: lines.join('\n'), line: indent + entry };
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

/** Ключі обʼєкта themes конфігу; null — якір відсутній. */
export function configThemeKeys(source) {
  const block = sliceBlock(source, ANCHORS.theme.anchor, '{', '}');
  if (block === null) return null;
  const entries = block.matchAll(
    /(?:^|\n)\s*'?([\w][\w./-]*)'?\s*:\s*\(\)\s*=>\s*import\(/g,
  );
  return [...entries].map((match) => match[1]);
}

/** Імена плагінів із масиву plugins конфігу; null — якір відсутній. */
export function configPluginNames(source) {
  const block = sliceBlock(source, ANCHORS.plugin.anchor, '[', ']');
  if (block === null) return null;
  return [...block.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]);
}
