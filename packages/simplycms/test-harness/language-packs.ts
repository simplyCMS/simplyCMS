// Тестовий реєстр мовних пакетів (§19.15): платформа постачає лише `uk` і `en` з усіма
// частинами, а гілки «пакет без `admin`» і «лише базова мова» без підміни реєстру недосяжні.
// Використання: `vi.mock('<відносно>/src/i18n/packs/registry', ...)` (відносним шляхом: аудит exports
// не пускає неекспортовані субшляхи), де фабрика
// динамічно імпортує цей файл (статичний імпорт піднімається вище за `vi.mock`).
import type { LanguagePack } from 'simplycms/i18n';

/** Пакет лише з `base` і `mail` (без `admin`): каталоги — позичені в `source`. */
export function packWithoutAdmin(
  code: string,
  name: string,
  source: LanguagePack,
): LanguagePack {
  return {
    code,
    name,
    ui: { base: source.ui.base, mail: source.ui.mail },
    content: {},
  };
}

/** Реєстр платформи + `de` і `pt` — пакети без частини `admin`. */
export function testPackRegistry(
  real: ReadonlyMap<string, LanguagePack>,
  extra: readonly string[] = [],
): ReadonlyMap<string, LanguagePack> {
  const uk = real.get('uk')!;
  return new Map([
    ...real,
    ['de', packWithoutAdmin('de', 'Deutsch', uk)],
    ['pt', packWithoutAdmin('pt', 'Português', uk)],
    // Вигадані коди мов у тестах замків і проєкції: вони перевіряють БД, а не наявність
    // пакета, тож отримують пакет без `admin`, щоб публікація не впиралась у І46.
    ...extra.map((code): [string, LanguagePack] => [
      code,
      packWithoutAdmin(code, code, uk),
    ]),
  ]);
}
