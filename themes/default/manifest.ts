import type { ThemeManifest } from 'simplycms/themes/types';

/**
 * Паспорт default-теми (контракт v2): ідентичність + діапазон сумісності
 * з ядром. Опис/автор більше не дублюються в маніфесті — вони живуть у
 * рядку таблиці `themes`.
 */
const manifest: ThemeManifest = {
  name: 'default',
  displayName: 'Default Theme',
  version: '0.1.0',
  // Тема використовує fonts-канал контракту v2.2 — потрібне ядро 0.3+.
  engines: { simplycms: '>=0.3.0' },
};

export default manifest;
