// Мовні пакети ядра. Реєстр закритий на етапі збірки (uk, en); мови магазину
// живуть у БД, і для більшості з них пакета немає: інтерфейс такої мови іде за основною
// (`resolveUiLocale`), а інструменти контенту чесно віддають `null`.
import type { ContentLocale } from 'simplycms/contracts';
import type { UiLocale } from '../ui-locale';
import type { LanguagePack } from '../types';
import { enPack } from './en';
import { ukPack } from './uk';

export const LANGUAGE_PACKS: ReadonlyMap<string, LanguagePack> = new Map([
  [ukPack.code, ukPack],
  [enPack.code, enPack],
]);

/**
 * Пакет мови інтерфейсу. `UiLocale` створюють лише конструктори, що перевіряють наявність
 * пакета, тож відсутність тут — порушення інваріанта, а не ситуація для `null`.
 */
export function getUiPack(ui: UiLocale): LanguagePack {
  const pack = LANGUAGE_PACKS.get(ui);
  if (!pack) throw new Error(`simplycms/i18n: немає мовного пакета «${ui}»`);
  return pack;
}

/**
 * Інструменти мови КОНТЕНТУ (транслітерація адрес) за ТОЧНИМ кодом або `null`: мова
 * контенту без пакета (`pl`) не помилка — адреси для неї вводяться вручну.
 */
export function getContentTools(
  code: ContentLocale,
): LanguagePack['content'] | null {
  return LANGUAGE_PACKS.get(code)?.content ?? null;
}
