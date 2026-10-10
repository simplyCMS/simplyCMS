/** Обʼєкт сховища, готовий до роздачі. */
export interface MediaObject {
  readonly size: number;
  /** Новий стрім на кожен виклик — відповідь можна віддати лише раз. */
  stream(): ReadableStream<Uint8Array>;
}

/**
 * Контракт драйвера сховища — СЕРВЕРНИЙ (рішення Е2-2).
 *
 * 🔴 Три методи й жодного `url`: адресу будує `resolveMediaUrl` (T1) з бази
 * драйвера, бо її мусить знати й клієнт, а драйвер у клієнт не потрапляє.
 *
 * 🔴 Присвоєння ключа тут НЕМАЄ навмисно: ключ генерує викликач
 * (`mediaKey`), бо той самий ключ мусить лягти в рядок `media` в ТІЙ САМІЙ
 * транзакції (Task 3). Драйвер, що вигадував би ключ сам, зробив би запис
 * рядка залежним від успіху запису файлу — тобто вивернув би порядок,
 * заданий інваріантами §4-К4.
 *
 * Драйвер `s3` у К4 реалізує рівно цей інтерфейс; presigned direct-upload
 * приходить туди АДИТИВНИМ `signPut?(key)`, не зміною цих трьох.
 */
export interface MediaStorageDriver {
  /** Записує НОВИЙ обʼєкт. Зайнятий ключ — `MediaKeyCollisionError`. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Видаляє обʼєкт. Відсутній — УСПІХ (ідемпотентність, рішення Е2-7). */
  delete(key: string): Promise<void>;
  /** Обʼєкт для роздачі або `null`, якщо ключа немає. */
  open(key: string): Promise<MediaObject | null>;
}

/**
 * Сховище операції, що публікує й прибирає файли (аватар, фото відгуку).
 *
 * 🔴 Канал ОДИН: `driver` дістається і публікації, і прибиранню орфана. Доки
 * їх було два незалежні параметри, викликач, який передав драйвер лише в
 * заміну, мовчки прибирав орфан у РЕАЛЬНИЙ `MEDIA_ROOT` замість свого
 * сховища: `discardMedia` ковтає помилку, а `local-fs.delete` вважає
 * `ENOENT` успіхом. `discardWith` лишає розбіжність можливою, але вже як
 * РІШЕННЯ — вона потрібна харнесу, де драйвер публікації навмисно зламаний
 * саме на видаленні. Порожнє поле = той самий драйвер.
 */
export interface MediaStorageOptions {
  readonly driver?: MediaStorageDriver;
  readonly discardWith?: MediaStorageDriver;
}

/** Ключ не відповідає контракту або веде за межі кореня сховища. */
export class MediaKeyError extends Error {
  constructor(readonly key: string) {
    super(
      `[simplycms/storage] Неприпустимий ключ медіа: ${JSON.stringify(key)}.`,
    );
    this.name = 'MediaKeyError';
  }
}

/** Ключ уже зайнятий. Обʼєкти іммутабельні — перезапис заборонено (Е2-8). */
export class MediaKeyCollisionError extends Error {
  constructor(readonly key: string) {
    super(`[simplycms/storage] Ключ медіа вже зайнятий: ${key}.`);
    this.name = 'MediaKeyCollisionError';
  }
}
