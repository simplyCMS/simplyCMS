import { describe, expect, it } from 'vitest';
import { toolPkgSmoke } from '../scripts/pilot-pack/tool-pkg-smoke.mjs';

// Gate TOOL — смоук ОПУБЛІКОВАНОГО артефакту `@simplycms/cli` в релізному
// ланцюзі.
//
// 🔴 Місце — саме packaging-suite, з тих самих причин, що й
// `create-store-pack.test.ts`: `publish-packages.yml` — єдиний workflow, який
// реально публікує, — ганяє лише `install → build:packages → test:packaging →
// pnpm publish -r`, тож тільки звідси гейт покриває всі три шляхи (CI-job,
// реліз, публікацію).
//
// Тіло смоку живе в `scripts/pilot-pack/tool-pkg-smoke.mjs` — рівно ту саму
// функцію викликає `scripts/pilot-pack/run.mjs` (рядок «Gate TOOL» у звіті
// пілота). Дублювати перевірку тут не можна: розійшлись би дві копії правди.
//
// Герметичність: `pnpm pack` + `tar` + `node`, без мережі й без Docker
// (залежності беруться симлінком, а їхня ДЕКЛАРАЦІЯ — асертом по манифесту з
// tarball). tsup-збірки пакет не має, тож смоук самодостатній — свіжий
// `pnpm build:packages` йому не потрібен.

describe('@simplycms/cli: смоук опублікованого tarball', () => {
  it('bin відпрацьовує, host/ у tarball, deps оголошені, версія збігається', () => {
    const { ok, details } = toolPkgSmoke();
    expect(ok, details.join('\n')).toBe(true);
  });
});
