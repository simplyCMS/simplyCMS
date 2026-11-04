// Мовні пакети ядра (uk, en). Мова магазину публікується лише з пакетом (спека §19.15,
// І46), тож у нормальному стані пакет є для кожної опублікованої мови. Мова без пакета
// лишається лише чернеткою, а опублікована мова, чий пакет зник з платформи, працює
// деградовано: інтерфейс іде за основною (`resolveUiLocale`, крок 3), сервер подає сигнал
// (`loadLocaleSet`), а інструменти контенту чесно віддають `null`.
import type { ContentLocale } from 'simplycms/contracts';
import type { UiLocale } from '../ui-locale';
import type { LanguagePack, UiCatalogPart } from '../types';
import { PACKS } from './registry';

/** Частина каталогу пакета; збігається з `UiCatalogPart`. */
export type UiPart = UiCatalogPart;

/** Опис пакета для споживачів: без лоадерів, лише що саме він містить. */
export type LanguagePackInfo = {
  readonly code: string;
  /** Назва мови її ж мовою. */
  readonly name: string;
  readonly parts: readonly UiPart[];
};

const ALL_PARTS: readonly UiPart[] = ['base', 'admin', 'mail'];

/** Частини, без яких мову не можна опублікувати: адмінські рядки необов'язкові (§19.15). */
const STOREFRONT_PARTS: readonly UiPart[] = ['base', 'mail'];

const partsOf = (pack: LanguagePack): UiPart[] =>
  ALL_PARTS.filter((part) => pack.ui[part] !== undefined);

/**
 * ЄДИНИЙ пошук пакета (Д12): точний код, далі базова мова (`pt-BR` → `pt`). На ньому стоять
 * і `resolveUiLocale` (кроки 1–2), і `hasLanguagePack`: дві реалізації розійшлися б, і
 * публікація пропустила б мову, для якої міст пакета не знайде.
 */
export function findLanguagePack(code: string): LanguagePack | null {
  const exact = PACKS.get(code);
  if (exact) return exact;
  try {
    return PACKS.get(new Intl.Locale(code).language) ?? null;
  } catch {
    // Формат коду гарантує `checkedContentLocale`, але публічний `hasLanguagePack(string)`
    // приймає довільний рядок: некоректний код — це «пакета немає», а не виняток.
    return null;
  }
}

/** Усі пакети ядра з назвою мови її ж мовою й наявними частинами. */
export function listLanguagePacks(): readonly LanguagePackInfo[] {
  return [...PACKS.values()].map((pack) => ({
    code: pack.code,
    name: pack.name,
    parts: partsOf(pack),
  }));
}

/**
 * Чи є пакет для коду (точний або базової мови) з усіма названими частинами. Типово — `base`
 * і `mail`: це умова публікації мови (І46); `admin` необов'язкова.
 */
export function hasLanguagePack(
  code: string,
  parts: readonly UiPart[] = STOREFRONT_PARTS,
): boolean {
  const pack = findLanguagePack(code);
  return pack !== null && parts.every((part) => pack.ui[part] !== undefined);
}

/**
 * Пакет мови інтерфейсу. `UiLocale` створюють лише конструктори, що перевіряють наявність
 * пакета, тож відсутність тут — порушення інваріанта, а не ситуація для `null`.
 */
export function getUiPack(ui: UiLocale): LanguagePack {
  const pack = PACKS.get(ui);
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
  return PACKS.get(code)?.content ?? null;
}
