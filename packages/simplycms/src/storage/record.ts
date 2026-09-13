import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { ActorDb } from 'simplycms/db';
import { media } from 'simplycms/schema';

import type { MediaStorageDriver } from './driver';
import { mediaKey, type MediaMime } from './keys';
import { getMediaDriver } from './local-fs';

export interface WriteMediaInput {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
  /** До чого належить файл: `product` / `banner` / `section` / `avatar` / … */
  readonly entityType: string;
  /** `null` — файл ще не привʼязаний до рядка (медіатека; привʼязка — К4). */
  readonly entityId: string | null;
  readonly uploadedBy: string | null;
}

export interface MediaRecord {
  readonly id: string;
  /** Те, що лягає в колонку сутності (рішення Е2-1). */
  readonly ref: string;
  readonly sizeBytes: number;
  readonly mime: MediaMime;
}

/**
 * Записати файл і його метадані ОДНИМ актом.
 *
 * 🔴 Порядок усередині — рядок, ПОТІМ файл, і це не сваволя: `size_bytes`
 * мусить лягти в ТУ САМУ транзакцію, що й запис (§4-К4), а транзакцією тут
 * володіє викликач (`withActor`). Тож якщо запис файлу впаде — виняток
 * підніметься з цієї функції, транзакція відкотиться, і не лишиться ні
 * рядка, ні обліку.
 *
 * 🔴 Чого цей порядок НЕ закриває: успішний `put` і невдалий COMMIT після
 * нього лишають обʼєкт без рядка — орфан. ФС не бере участі в двофазному
 * коміті, тож інакше й бути не може; напрямок обрано безпечний (облік
 * НЕ рахує байти, яких ніхто не адресує), а sweep орфанів — К4.
 *
 * 🔴 `id` передається ЯВНО: `DEFAULT gen_random_uuid()` знято на всіх
 * таблицях Категорії A (К3-Е0), тож вставка без `id` дала б `23502`.
 *
 * 🔴 Дзеркального `discardMedia` всередині НЕМАЄ, і це не пропуск: якщо
 * `driver.put` кидає, обʼєкт не опублікований (тимчасовий файл прибирає
 * `finally` драйвера), а рядок відкочує транзакція викликача. Прибирати
 * нічого. «Вирівнювати» з `eraseMedia` заради симетрії не треба — там
 * необоротна дія вже сталась, тут ні.
 */
export async function writeMedia(
  db: ActorDb,
  input: WriteMediaInput,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<MediaRecord> {
  const id = randomUUID();
  const ref = mediaKey(input.mime);
  const sizeBytes = input.bytes.byteLength;

  await db.insert(media).values({
    // 🔴 `id: id`, не шортхенд: гейт `explicit-ids` (`insert-scan.ts`)
    // розпізнає поле САМЕ як `id:` — узгоджено з рештою вставок ядра
    // (`orders.ts`, `addresses.ts`), де той самий запис.
    id: id,
    entityType: input.entityType,
    entityId: input.entityId,
    storageKey: ref,
    sizeBytes,
    mimeType: input.mime,
    uploadedBy: input.uploadedBy,
  });

  await driver.put(ref, input.bytes);

  return { id, ref, sizeBytes, mime: input.mime };
}

/**
 * Best-effort прибирання щойно записаного обʼєкта після ВІДКОТУ транзакції.
 *
 * 🔴 Потрібне там, де файл уже опубліковано, а транзакція впала пізніше:
 * rollback прибирає рядок `media`, але диск транзакцій не знає — обʼєкт
 * лишився б орфаном. Кличеться з `catch` ЗОВНІ транзакції (всередині вона
 * вже мертва).
 *
 * 🔴 ОДНЕ документоване місце, де помилка прибирання ковтається. Саме одне:
 * розсипані по викликачах `.catch(() => {})` рано чи пізно проковтнуть щось
 * інше. Первинну помилку це не маскує — функція нічого не кидає, а викликач
 * перекидає свою далі сам.
 *
 * 🔴 `console.warn`, а не тиша: орфан мусить лишати слід, інакше sweep К4 не
 * має жодного сигналу, що він узагалі потрібен. `ref` у повідомленні
 * обовʼязковий — без нього запис у лозі не дає чим шукати обʼєкт.
 */
export async function discardMedia(
  ref: string,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<void> {
  try {
    await driver.delete(ref);
  } catch (error) {
    console.warn('[simplycms/storage] discard failed', ref, error);
  }
}

/**
 * Прибрати файл і його рядок. Повертає `false`, якщо рядка не було.
 *
 * 🔴 ІНВАРІАНТ (амендмент §4-К4 від 2026-09-13, рішення Е2-7): обʼєкт
 * видаляється **всередині транзакції рядка, ПІСЛЯ `DELETE` і ДО `COMMIT`**.
 * Транзакцією володіє викликач (`withActor`), тож «до COMMIT» тут означає
 * «до виходу з його колбека».
 *
 * Що це дає, по класах відмов:
 *   • помилка БД (грант, конфлікт, будь-що) — падає ДО дотику до диска,
 *     rollback, і рядок, і файл на місці;
 *   • помилка сховища — виняток піднімається з цієї функції, rollback
 *     повертає рядок, файл теж на місці;
 *   • **fail-open неможливий за побудовою**: стан «рядок закомічено, обʼєкт
 *     лишився» недосяжний, а це і є «квота, яку неможливо звільнити» —
 *     задокументована граблина MetaHub.
 *
 * 🔴 ПРИНЦИП, що обʼєднує це рішення з порядком заміни аватара: необоротна
 * дія (`unlink`, `deleteObject`) стоїть якомога пізніше в транзакції, одразу
 * перед COMMIT, щоб вікно «необоротне вже сталось, а відкат ще можливий»
 * звужувалось до самого коміту. Тут це реалізовано ВСЕРЕДИНІ одного
 * видалення; у заміні аватара (Task 5) — між кількома кроками, тож старий
 * обʼєкт прибирається останнім.
 *
 * 🔴 Залишковий стан рівно ОДИН: падіння COMMIT уже після успішного
 * `driver.delete` лишає рядок без обʼєкта. Облік ПЕРЕоцінює обсяг (тариф не
 * занижений), і повтор його лікує — `driver.delete` на відсутньому обʼєкті
 * повертає успіх (`ENOENT` для `local-fs`, `204` для S3 у К4). Облік
 * невдалих повторів — К4.
 *
 * 🔴 Чому НЕ «спершу обʼєкт, потім рядок», як казала перша редакція спеки:
 * за тим порядком будь-яка відмова БД після `driver.delete` знищувала файл
 * безповоротно. Найдешевший приклад — актор без гранта `DELETE` на `media`:
 * файл зник, рядок лишився, і повтор його НЕ лікує, бо права не зʼявляться.
 * Найгірший залишковий стан в обох порядках однаковий, але цей прибирає
 * цілий клас відмов.
 *
 * 🔴 Зовнішні референси (`https:`/`data:`/`/…`) сюди не доходять: вони не
 * є ключами сховища, рядка `media` не мають, і функція чесно поверне
 * `false`, нічого не видаливши.
 */
export async function eraseMedia(
  db: ActorDb,
  ref: string,
  driver: MediaStorageDriver = getMediaDriver(),
): Promise<boolean> {
  // `for update` — щоб два паралельні видалення того самого референсу не
  // дійшли обидва до `driver.delete`: другий чекає на локу й побачить
  // порожній результат `DELETE`.
  const [row] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.storageKey, ref))
    .limit(1)
    .for('update');
  if (!row) return false;

  const deleted = await db
    .delete(media)
    .where(and(eq(media.id, row.id), eq(media.storageKey, ref)))
    .returning({ id: media.id });
  if (deleted.length === 0) return false;

  // 🔴 ПІСЛЯ DELETE і ДО COMMIT. Виняток звідси відкочує рядок разом із
  // транзакцією викликача — саме тому порядок не можна «оптимізувати»,
  // винісши цей виклик за межі `withActor`.
  await driver.delete(ref);

  return true;
}
