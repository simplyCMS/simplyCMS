// Мовні пакети ядра. Реєстр закритий на етапі збірки (uk, en); мови магазину
// живуть у БД, і для більшості з них пакета немає — тоді `getLanguagePack`
// чесно віддає `null`.
import type { LanguagePack } from '../types';
import { enPack } from './en';
import { ukPack } from './uk';

export const LANGUAGE_PACKS: ReadonlyMap<string, LanguagePack> = new Map([
  [ukPack.code, ukPack],
  [enPack.code, enPack],
]);

/** Пакет за точним кодом мови або `null`. */
export function getLanguagePack(code: string): LanguagePack | null {
  return LANGUAGE_PACKS.get(code) ?? null;
}
