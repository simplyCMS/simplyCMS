import { describe, expect, it } from 'vitest';
import { createPkgSmoke } from '../scripts/pilot-pack/create-pkg-smoke.mjs';

// Гейт ОПУБЛІКОВАНОГО артефакту скаффолдера в релізному ланцюзі.
//
// 🔴 Чому саме packaging-suite, а не `pnpm test`: `publish-packages.yml` —
// єдиний workflow, який реально публікує, — ганяє лише
// `install → build:packages → test:packaging → pnpm publish -r`. `pnpm test`
// він не запускає взагалі. Та сама сюїта входить у `pnpm release`, тож це
// єдине місце, звідки гейт покриває всі три шляхи (CI-job, реліз, публікацію).
//
// Тіло смоку живе в `scripts/pilot-pack/create-pkg-smoke.mjs` — рівно ту саму
// функцію викликає `scripts/pilot-pack/run.mjs` (рядок «Gate CLI» у звіті
// пілота). Дублювати перевірку тут не можна: розійшлись би дві копії правди.
//
// Герметичність: `pnpm pack` + `tar` + `node`, без мережі й без Docker
// (залежності беруться симлінком, а їхня ДЕКЛАРАЦІЯ — асертом по манифесту з
// tarball). З треком К0 смоук пакує ще й флагман `simplycms` — щоб довести
// точну парність теки `skills/` у його tarball, — тож іде вже кілька секунд,
// а не «~0.3 s»; на `testTimeout` сюїти (300 s) це не тисне.

describe('create-simplycms-store: смоук опублікованого tarball', () => {
  it('tarball містить template/, bin розгортає магазин, deps оголошені', () => {
    const { ok, details } = createPkgSmoke();
    expect(ok, details.join('\n')).toBe(true);
  });
});
