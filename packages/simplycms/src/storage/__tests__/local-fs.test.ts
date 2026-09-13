import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import {
  MediaKeyCollisionError,
  MediaKeyError,
  localFsDriver,
} from '../local-fs';
import { MEDIA_KEY_RE } from '../keys';

const KEY = 'ab/ab000000-0000-4000-8000-000000000000.png';
const OTHER_KEY = 'cd/cd000000-0000-4000-8000-000000000001.webp';
const PAYLOAD = Uint8Array.from([1, 2, 3, 4]);

/**
 * Куди драйвер писав НАСПРАВДІ.
 *
 * 🔴 Шпигун на `node:fs/promises`, а не асерт проти `mediaTmpName()`: гейт
 * мусить червоніти на зміну самого `put`. Ізольований асерт функції цього не
 * бачив — заміна `join(shard, mediaTmpName())` на `\`\${randomUUID()}.png\``
 * лишала його зеленим, а роздача віддала б частково записаний файл під
 * `immutable`-кешем. Шпигун ДЕЛЕГУЄ в реальний `writeFile`, тож решта сюїти
 * працює з живою файловою системою.
 */
const written = vi.hoisted(() => [] as string[]);

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const spy: typeof actual.writeFile = (file, data, options) => {
    if (typeof file === 'string') written.push(file);
    return actual.writeFile(file, data, options);
  };
  return { ...actual, writeFile: spy };
});

describe('localFsDriver', () => {
  let root: string;
  let driver: ReturnType<typeof localFsDriver>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'simplycms-media-'));
    driver = localFsDriver(root);
    written.length = 0;
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('put створює шард-теку й кладе байти', async () => {
    await driver.put(KEY, PAYLOAD);
    expect(new Uint8Array(await readFile(join(root, KEY)))).toEqual(PAYLOAD);
  });

  it('put на зайнятий ключ падає MediaKeyCollisionError і НЕ перезаписує', async () => {
    await driver.put(KEY, PAYLOAD);
    await expect(
      driver.put(KEY, Uint8Array.from([9, 9])),
    ).rejects.toBeInstanceOf(MediaKeyCollisionError);
    expect(new Uint8Array(await readFile(join(root, KEY)))).toEqual(PAYLOAD);
  });

  it('put не лишає тимчасових файлів — ні після успіху, ні після колізії', async () => {
    await driver.put(KEY, PAYLOAD);
    await driver.put(KEY, PAYLOAD).catch(() => undefined);
    const shard = await readdir(join(root, 'ab'));
    expect(shard.filter((name) => name.startsWith('.tmp-'))).toEqual([]);
  });

  // 🔴 Не косметика імені: сирота `.tmp-*` після падіння між `link` і
  // `unlink` — названа межа Е2, і єдине, що робить її нешкідливою, — те,
  // що роут роздачі такого імені не приймає. `MEDIA_KEY_RE` не вимагає, щоб
  // шард дорівнював префіксу uuid, тож `ab/<будь-який uuid>.png` регекс
  // проходить — тимчасове імʼя з дозволеним розширенням роздалося б як
  // готовий обʼєкт, ще й з `immutable`-кешем.
  it('put пише під імʼям, яке роздача НЕ віддасть, і щоразу новим', async () => {
    await driver.put(KEY, PAYLOAD);
    await driver.put(OTHER_KEY, PAYLOAD);

    expect(
      written,
      'шпигун не побачив запису — гейт став би порожнім',
    ).toHaveLength(2);
    const names = written.map((p) => relative(root, p).replaceAll('\\', '/'));
    for (const [i, name] of names.entries()) {
      expect(MEDIA_KEY_RE.test(name), `${name} матчить ключ роздачі`).toBe(
        false,
      );
      // Той самий шард, що й у ключа: `link` не працює через межу ФС.
      expect(dirname(name)).toBe(dirname([KEY, OTHER_KEY][i]));
    }
    expect(names[0]).not.toBe(names[1]);
  });

  it('delete прибирає обʼєкт', async () => {
    await driver.put(KEY, PAYLOAD);
    await driver.delete(KEY);
    expect(await driver.open(KEY)).toBeNull();
  });

  it('delete відсутнього — УСПІХ (ідемпотентність, рішення Е2-7)', async () => {
    await expect(driver.delete(KEY)).resolves.toBeUndefined();
    await expect(driver.delete(KEY)).resolves.toBeUndefined();
  });

  it('open віддає розмір і стрім із тими самими байтами', async () => {
    await driver.put(KEY, PAYLOAD);
    const object = await driver.open(KEY);
    expect(object?.size).toBe(PAYLOAD.length);
    const chunks: Uint8Array[] = [];
    for await (const chunk of object!.stream() as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(
      Buffer.from(PAYLOAD),
    );
  });

  it('open відсутнього → null, а не виняток', async () => {
    expect(await driver.open(KEY)).toBeNull();
  });

  // 🔴 Traversal перевіряється на ДРАЙВЕРІ, а не лише в роуті: другий
  // виклик порту (адмінка) прийде не з URL і роутового гарда не матиме.
  it.each([
    '../escape.png',
    'ab/../../escape.png',
    '/etc/passwd',
    'ab/ab000000-0000-4000-8000-000000000000.png/../../../escape.png',
  ])('ключ поза коренем відбивається: %s', async (bad) => {
    await expect(driver.put(bad, PAYLOAD)).rejects.toBeInstanceOf(
      MediaKeyError,
    );
    await expect(driver.delete(bad)).rejects.toBeInstanceOf(MediaKeyError);
    await expect(driver.open(bad)).rejects.toBeInstanceOf(MediaKeyError);
  });

  it('файл поза коренем не читається навіть якщо існує', async () => {
    const outside = join(root, '..', `escape-${process.pid}.png`);
    await writeFile(outside, PAYLOAD);
    try {
      await expect(
        driver.open(`../escape-${process.pid}.png`),
      ).rejects.toBeInstanceOf(MediaKeyError);
    } finally {
      await rm(outside, { force: true });
    }
  });
});
