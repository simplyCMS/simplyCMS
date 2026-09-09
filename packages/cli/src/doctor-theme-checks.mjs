// Оффлайн-перевірка тем (Фаза 4, Р6 — conformance-kit v1). Рівень WARN і
// окрема перевірка, а не розширення №9: №9 має рівень error і лагодиться
// `update --write`, а тут обидві знахідки лагодяться руками — тека теми може
// бути свідомо ще не створена, а `tailwind.config.ts` узагалі поза каноном
// host/, тож `update` його не чіпає.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configThemeEntries } from './config-edit.mjs';

/** @typedef {import('./ui.mjs').Check} Check */

const ID = 'themes';
const TITLE = 'Теми: записи конфігу резолвляться, Tailwind їх бачить';

/** Глоби сторонніх тем (Р7) — маркер їхньої наявності в tailwind.config.ts. */
const THEME_GLOB_MARKER = 'simplycms-theme-*';

/** Конвенція неймінгу теми (Р1): базове імʼя починається з simplycms-theme-. */
const THEME_PACKAGE_RE = /^(?:@[^/]+\/)?simplycms-theme-/;

/** @type {(details: string) => Check} */
const warn = (details) => ({ id: ID, title: TITLE, status: 'warn', details });

/** @type {(details: string) => Check} */
const skip = (details) => ({ id: ID, title: TITLE, status: 'skip', details });

/** Імʼя пакета зі специфікатора import(): scope — це дві частини шляху. */
export function specPackageName(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Чи резолвиться запис теми. Локальний (copy-in/скаффолд) специфікатор
 * `@themes/<dir>/index` — тека магазину; будь-який інший — пакет у
 * node_modules. Перевіряємо саме СПЕЦИФІКАТОР, а не ключ: через `--name`
 * ключ конфігу може не збігатися ні з текою, ні з іменем пакета.
 * @param {string} storeRoot
 * @param {{ spec: string }} entry
 */
export function resolveThemeEntry(storeRoot, { spec }) {
  if (spec.startsWith('@themes/')) {
    const dir = spec.slice('@themes/'.length).split('/')[0];
    return existsSync(join(storeRoot, 'themes', dir));
  }
  const pkg = specPackageName(spec);
  return existsSync(join(storeRoot, 'node_modules', ...pkg.split('/')));
}

/**
 * Чи потрібен цьому пакету окремий Tailwind-глоб. Референс-теми ядра
 * (`@simplycms/theme-*`) уже покриті глобом `node_modules/@simplycms/*`,
 * тож підказку про них не даємо.
 * @param {string} pkg
 */
export function needsThemeGlob(pkg) {
  return !pkg.startsWith('@simplycms/') && THEME_PACKAGE_RE.test(pkg);
}

/**
 * №11: кожен запис themes-конфігу резолвиться + Tailwind бачить сторонні теми.
 * @param {{ storeRoot: string }} ctx
 * @returns {Check}
 */
export function checkThemes({ storeRoot }) {
  const configPath = join(storeRoot, 'simplycms.config.ts');
  if (!existsSync(configPath))
    return skip('Немає simplycms.config.ts — перевіряти нічого');
  const entries = configThemeEntries(readFileSync(configPath, 'utf8'));
  if (entries === null)
    return skip('Якір «themes: {» не знайдено — це показує окрема перевірка');
  if (entries.length === 0)
    return warn('У themes немає жодного запису — магазин лишиться без теми');

  const problems = entries
    .filter((entry) => !resolveThemeEntry(storeRoot, entry))
    .map(
      ({ key, spec }) =>
        `«${key}» → ${spec}: немає ні теки themes/, ні пакета в node_modules`,
    );
  const globHint = missingGlobHint(storeRoot, entries);
  if (globHint) problems.push(globHint);
  return problems.length > 0
    ? warn(problems.join('\n'))
    : { id: ID, title: TITLE, status: 'ok' };
}

/** Підказка про глоби Р7 — лише коли стороння тема є, а глоба немає. */
function missingGlobHint(storeRoot, entries) {
  const third = entries
    .map(({ spec }) => specPackageName(spec))
    .filter(needsThemeGlob);
  if (third.length === 0) return null;
  const tailwindPath = join(storeRoot, 'tailwind.config.ts');
  if (!existsSync(tailwindPath)) return null;
  if (readFileSync(tailwindPath, 'utf8').includes(THEME_GLOB_MARKER))
    return null;
  return (
    `Теми ${third.join(', ')} — сторонні, а tailwind.config.ts їх не сканує: ` +
    'додай у content глоби ' +
    `'./node_modules/${THEME_GLOB_MARKER}/dist/**/*.js' і ` +
    `'./node_modules/@*/${THEME_GLOB_MARKER}/dist/**/*.js' — інакше класи теми ` +
    'просто не потраплять у CSS'
  );
}
