import type { ThemeManifest } from '@simplycms/themes/types';

/**
 * Паспорт теми SolarStore (контракт v2): ідентичність + діапазон сумісності
 * з ядром. Опис/автор більше не дублюються в маніфесті — вони живуть у
 * рядку таблиці `themes`.
 *
 * 🔴 `version` — рядок-літерал, а модель версій ядра СИНХРОННА: його
 * переписує `scripts/release/bump.mjs` разом із `package.json`, парність
 * стереже `tests/theme-manifest-parity.test.ts`. Формат літерала не міняти —
 * bump шукає його строгим regex-ом і без збігу падає.
 */
const manifest: ThemeManifest = {
  name: 'solarstore',
  displayName: 'SolarStore Default',
  version: '0.3.0',
  engines: { simplycms: '>=0.1.0' },
};

export default manifest;
