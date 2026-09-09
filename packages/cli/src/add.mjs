// simplycms add <pkg> (--plugin | --theme): build-time-встановлення зі спеки
// §4.2 — pnpm add → якірний запис у simplycms.config.ts → нагадування про
// rebuild. Тип обовʼязковий: автодетекції у v1 немає (§3). `--copy` (Фаза 4,
// Р5) — друга гілка установки теми зі спеки §17.4; сценарій — add-copy.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAddArgs } from './add-args.mjs';
import { runThemeCopy } from './add-copy.mjs';
import { addSteps, themeSteps } from './add-steps.mjs';
import {
  assertThemeKeyFree,
  deriveKey,
  hasPackage,
  insertEntry,
} from './config-edit.mjs';
import { findStoreRoot } from './context.mjs';
import { begin, finish, say, showSteps } from './ui.mjs';

// Реекспорт: парсер — частина публічної поверхні команди (юніти add).
export { parseAddArgs };

/** Гілка `--copy`: сценарій в add-copy.mjs, тут — лише вивід. */
function reportCopy(report, { pkg, key }) {
  if (report.status === 'done') {
    say.success(`themes/${key} уже є і підключена в конфізі — нічого робити.`);
    finish('Вже зроблено.');
    return;
  }
  if (report.status === 'dry-run') {
    say.info(
      `--dry-run: сирці ${pkg} лягли б у themes/${key}, пакет було б знято` +
        (report.line
          ? `, у simplycms.config.ts додався б рядок:\n+ ${report.line}`
          : ''),
    );
    finish('Нічого не змінено (--dry-run).');
    return;
  }
  say.success(
    `themes/${key}: скопійовано ${report.copied.join(', ')} з ${pkg}; пакет знято.`,
  );
  if (report.added.length > 0) {
    say.info(
      `package.json: перенесено залежності теми — ${report.added.join(', ')}`,
    );
  }
  showSteps(themeSteps());
  finish('Готово.');
}

/** @param {string[]} argv */
export async function run(argv) {
  const options = parseAddArgs(argv);
  begin('simplycms add');
  const storeRoot = findStoreRoot();
  const configPath = join(storeRoot, 'simplycms.config.ts');
  if (!existsSync(configPath))
    throw new Error(`Не знайдено ${configPath} — add не має куди писати`);
  const key = deriveKey(options.pkg, options.name);

  if (options.copy) {
    const report = runThemeCopy({
      storeRoot,
      configPath,
      pkg: options.pkg,
      key,
      dryRun: options.dryRun,
    });
    reportCopy(report, { pkg: options.pkg, key });
    return;
  }

  const source = readFileSync(configPath, 'utf8');
  // Ідемпотентність — не fallback: повторний запуск без роботи = успіх (§3).
  if (hasPackage(source, options.pkg)) {
    say.success(`«${options.pkg}» вже в simplycms.config.ts — нічого робити.`);
    finish('Вже зроблено.');
    return;
  }

  // Дзеркало гарда copy-гілки: ключ теми, зайнятий іншим специфікатором
  // (та сама тема, вже вкопійована в themes/<key>), дав би дубль ключа в
  // обʼєкті themes — битий конфіг. Плагінів не стосується: там масив.
  if (options.type === 'theme') assertThemeKeyFree(source, key, options.pkg);

  // Вставка рахується ДО install: відсутній якір валить команду, поки
  // нічого не змінено — ні конфіг, ні node_modules.
  const next = insertEntry(source, {
    type: options.type,
    key,
    pkg: options.pkg,
  });
  if (options.dryRun) {
    say.info(
      `--dry-run: у simplycms.config.ts додався б рядок (після якоря):\n+ ${next.line}`,
    );
    finish('Нічого не змінено (--dry-run).');
    return;
  }

  if (options.install) {
    say.step(`pnpm add ${options.pkg}`);
    // Помилка install летить нагору як є: конфіг ще не змінено.
    execFileSync('pnpm', ['add', options.pkg], {
      cwd: storeRoot,
      stdio: 'inherit',
    });
  }
  writeFileSync(configPath, next.source);
  const kind = options.type === 'plugin' ? 'плагін' : 'тему';
  say.success(`simplycms.config.ts: додано ${kind} '${key}'.`);

  showSteps(
    await addSteps({ storeRoot, pkg: options.pkg, type: options.type }),
  );
  finish('Готово.');
}
