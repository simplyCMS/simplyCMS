import type { ThemeManifest } from "@simplycms/themes/types";

/**
 * Паспорт теми SolarStore (контракт v2): ідентичність + діапазон сумісності
 * з ядром. Опис/автор більше не дублюються в маніфесті — вони живуть у
 * рядку таблиці `themes`.
 */
const manifest: ThemeManifest = {
  name: "solarstore",
  displayName: "SolarStore Default",
  version: "1.0.0",
  engines: { simplycms: "^0.1.0" },
};

export default manifest;
