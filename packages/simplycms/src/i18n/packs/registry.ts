import type { LanguagePack } from '../types';
import { enPack } from './en';
import { ukPack } from './uk';

/**
 * Реєстр мовних пакетів ядра, закритий на етапі збірки. НЕ експортується з `simplycms/i18n`:
 * публічні лише `listLanguagePacks` / `hasLanguagePack` (спека §19.15), тож пізніший канал
 * постачання пакетів ззовні додасть нове джерело сюди, не ламаючи споживачів. Окремий
 * файл — щоб тест підміняв реєстр (пакет без `admin`, лише базова мова), не чіпаючи логіку.
 */
export const PACKS: ReadonlyMap<string, LanguagePack> = new Map([
  [ukPack.code, ukPack],
  [enPack.code, enPack],
]);
