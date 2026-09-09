import { describe, expect, it } from 'vitest';
import { formatGap, runAudit } from '../scripts/audit-deps.mjs';
import {
  collectImports,
  collectPackages,
} from '../scripts/audit-deps/collect.mjs';

// Крос-пакетний гейт (Task 1.3): кожен bare-імпорт з publish-root-ів пакета
// (`src/` і `routes/`) має бути оголошений у `dependencies` або
// `peerDependencies` цього ж пакета. У монорепо розрив невидимий —
// workspace-аліаси й hoisted-корінь `node_modules` резолвлять що завгодно;
// вилізе він лише на справжньому `pnpm install` з tarball-а (Етап 3, пілот)
// як `ERR_MODULE_NOT_FOUND` у споживача.
describe('audit-deps: manifest покриває всі bare-імпорти', () => {
  it('0 недекларованих залежностей', () => {
    const { missing, scanned, packages } = runAudit();

    if (missing.length > 0) {
      throw new Error(
        `Знайдено ${missing.length} недекларованих залежностей:\n${missing
          .map(formatGap)
          .join('\n')}`,
      );
    }

    expect(packages).toBeGreaterThan(0);
    expect(scanned).toBeGreaterThan(0);
  });
});

// 🔴 Покриття publish-root-ів (закрито 2026-08-21). `skills/` їде в tarball-і
// флагмана і виконується з `node_modules/simplycms/skills/`, але в
// `PUBLISH_ROOTS` теки не було — сканер її не бачив, тобто недекларована
// залежність скіла пройшла б повз гейт і вилізла аж у магазині. Асертимо не
// сам список, а ФАКТ обходу: інакше видалення теки зі списку лишилось би
// непоміченим.
//
// Межа критерію: `host/`, `template-plugin/`, `template-theme/` пакета
// `@simplycms/cli` теж є в його `files`, але publish-root-ами НЕ є свідомо —
// їх КОПІЮЮТЬ у магазин, тож їхні імпорти (`simplycms/*`, `sirv`, …)
// резолвляться проти manifest-а МАГАЗИНУ, а не CLI.
describe('audit-deps: publish-root-и покривають skills/', () => {
  it('сканер бачить файли skills/ флагмана', () => {
    const flagship = collectPackages().get('simplycms');
    expect(flagship).toBeDefined();

    const scannedFiles = [...collectImports(flagship!).values()]
      .flat()
      .filter((file: string) => file.includes('/skills/'));

    expect(scannedFiles.length).toBeGreaterThan(0);
  });
});
