// Спільний контрактний набір драйверів сховища (К3-Е8, Task 8).
//
// 🔴 Один набір на всі драйвери: контракт `MediaStorageDriver` — це поведінка,
// а не форма інтерфейсу. Драйвер, що проходить типи, але перезаписує зайнятий
// ключ чи падає на `delete` відсутнього, ламає outbox стирання й іммутабельність
// об'єктів, тож кожен новий драйвер зобовʼязаний пройти ці самі кейси.
import { describe, expect, it } from 'vitest';
import {
  MediaKeyCollisionError,
  mediaKey,
  type MediaStorageDriver,
} from 'simplycms/storage';

export type DriverFixture = {
  driver: MediaStorageDriver;
  cleanup(): Promise<void>;
};

const PAYLOAD = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);

/** Зчитує стрім повністю. */
async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/**
 * Ключі — `mediaKey(...)`, унікальні між прогонами: Garage стенду живе між
 * ними, тож фіксований ключ колізував би зі сміттям попереднього запуску.
 */
export function runDriverContract(
  name: string,
  make: () => Promise<DriverFixture>,
): void {
  describe(`контракт MediaStorageDriver: ${name}`, () => {
    const withDriver = async (
      run: (driver: MediaStorageDriver) => Promise<void>,
    ): Promise<void> => {
      const { driver, cleanup } = await make();
      try {
        await run(driver);
      } finally {
        await cleanup();
      }
    };

    it('put на зайнятий ключ падає MediaKeyCollisionError і НЕ перезаписує', () =>
      withDriver(async (driver) => {
        const key = mediaKey('image/png');
        await driver.put(key, PAYLOAD);
        try {
          await expect(
            driver.put(key, Uint8Array.from([9, 9])),
          ).rejects.toBeInstanceOf(MediaKeyCollisionError);
          const object = await driver.open(key);
          expect(await readAll(object!.stream())).toEqual(Buffer.from(PAYLOAD));
        } finally {
          await driver.delete(key);
        }
      }));

    it('delete відсутнього — УСПІХ (ідемпотентність, рішення Е2-7)', () =>
      withDriver(async (driver) => {
        const key = mediaKey('image/png');
        await expect(driver.delete(key)).resolves.toBeUndefined();
        await expect(driver.delete(key)).resolves.toBeUndefined();
      }));

    it('open відсутнього → null, а не виняток', () =>
      withDriver(async (driver) => {
        expect(await driver.open(mediaKey('image/webp'))).toBeNull();
      }));

    it('put → open: ті самі байти, size = довжина, два stream() — два повних стріми', () =>
      withDriver(async (driver) => {
        const key = mediaKey('image/jpeg');
        await driver.put(key, PAYLOAD);
        try {
          const object = await driver.open(key);
          expect(object?.size).toBe(PAYLOAD.length);
          const first = await readAll(object!.stream());
          const second = await readAll(object!.stream());
          expect(first).toEqual(Buffer.from(PAYLOAD));
          expect(second).toEqual(Buffer.from(PAYLOAD));
        } finally {
          await driver.delete(key);
        }
      }));

    it('delete прибирає обʼєкт: після нього open → null', () =>
      withDriver(async (driver) => {
        const key = mediaKey('image/png');
        await driver.put(key, PAYLOAD);
        await driver.delete(key);
        expect(await driver.open(key)).toBeNull();
      }));
  });
}
