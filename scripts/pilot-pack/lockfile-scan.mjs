/**
 * Розбір `pnpm-lock.yaml` скретча: які пакети ЯДРА туди потрапили й звідки.
 *
 * Винесено з `provenance.mjs` (ліміт рядків): там лишається рішення гарда —
 * зелено чи червоно, — тут лише механіка читання lockfile-а.
 *
 * Джерело правди — секція `packages:`: вона перелічує ВЕСЬ граф, включно з
 * транзитивними, тож покриває саме той випадок, заради якого overrides і
 * потрібні.
 */

/** Специфікатор локального tarball-а у формі, якою його пише pnpm. */
const LOCAL = 'file:';

/**
 * Предикат «цей ключ lockfile стосується ядра».
 *
 * 🔴 Форм імені ДВІ, і зводити їх до однієї не можна (топологія 5, трек К0).
 * Scoped-сателіти (`@simplycms/cli`, `@simplycms/plugin-faq`, …) відбираються
 * ПРЕФІКСОМ scope — саме широта префікса й ловить нове імʼя ядра, про яке
 * пілот ще не знає (воно піде в `unknown`). Unscoped-флагман `simplycms`
 * відбирається ЛИШЕ точним іменем із `@`: префіксний збіг прихопив би
 * сторонні `simplycms-theme-*`/`simplycms-plugin-*` із реєстру (конвенція
 * неймінгу сторонніх пакетів) і повалив би гард фальшивим `unknown`.
 *
 * @param {string[]} coreNames імена пакетів ядра, спакованих у tarball-и
 * @returns {(key: string) => boolean}
 */
function coreKeyMatcher(coreNames) {
  const scopes = [
    ...new Set(
      coreNames
        .filter((name) => name.startsWith('@'))
        .map((name) => name.slice(0, name.indexOf('/') + 1)),
    ),
  ].filter(Boolean);
  const unscoped = coreNames.filter((name) => !name.startsWith('@'));

  return (key) =>
    scopes.some((scope) => key.startsWith(scope)) ||
    unscoped.some((name) => key.startsWith(`${name}@`));
}

/**
 * Зібрати пакети ядра із секції `packages:` lockfile-а.
 *
 * 🔴 Саме `packages:`, а не `snapshots:`: обидві секції повторюють ті самі
 * ключі, тож рахувати треба одну — інакше кожен пакет подвоївся б.
 *
 * 🔴 Ключ розбирається збігом за ВІДОМИМ іменем (`<name>@`), а не пошуком
 * роздільника. Ключі pnpm 9 несуть суфікс peer-залежностей, іноді вкладений
 * (`'@babel/x@7.29.7(@babel/core@7.29.7(supports-color@7.2.0))'`), а
 * `file:`-специфікатор — довільний шлях; будь-яка евристика на `indexOf`/
 * `lastIndexOf` ламається на одному з цих двох випадків. Перелік імен у нас і
 * так є (усе, що спакував `packAll`), тож здогадуватись не треба.
 *
 * @param {string} source вміст `pnpm-lock.yaml`
 * @param {string[]} coreNames імена пакетів ядра — вони ж джерело відбору
 *   ключів (scope для сателітів, точне імʼя для unscoped-флагмана)
 * @returns {{ entries: Map<string,string>, fromRegistry: string[], unknown: string[] }}
 *   `entries` — імʼя → специфікатор; `fromRegistry` — ПОВНІ ключі тих, що
 *   приїхали не з tarball-а; `unknown` — пакети зі scope ядра, яких немає
 *   серед спакованих (нове імʼя, про яке пілот не знає; для unscoped-форми
 *   такого сигналу немає — див. `coreKeyMatcher`).
 */
export function parseCorePackages(source, coreNames) {
  const isCoreKey = coreKeyMatcher(coreNames);

  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === 'packages:');
  const entries = new Map();
  const fromRegistry = [];
  const unknown = [];
  if (start < 0) return { entries, fromRegistry, unknown };

  for (const line of lines.slice(start + 1)) {
    // Наступна секція верхнього рівня (`snapshots:`) завершує перебір.
    if (/^\S/.test(line)) break;
    const match = /^ {2}'?(.+?)'?:$/.exec(line);
    if (!match) continue;

    const key = match[1];
    if (!isCoreKey(key)) continue;

    const name = coreNames.find((candidate) => key.startsWith(`${candidate}@`));
    if (!name) {
      unknown.push(key);
      continue;
    }

    const spec = key.slice(name.length + 1);
    entries.set(name, spec);
    if (!spec.startsWith(LOCAL)) fromRegistry.push(key);
  }

  return { entries, fromRegistry, unknown };
}
