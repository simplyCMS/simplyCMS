/**
 * PNG-зображення товарів, згенеровані кодом (С-5).
 *
 * 🔴 Ні бінарників у репо, ні мережі, ні ліцензійних питань: картинка —
 * детермінована функція seed-а. Формат мінімальний, але валідний: сигнатура,
 * IHDR (RGB, 8 біт), один IDAT (`deflateSync`) і IEND, кожен чанк із crc32 —
 * інакше `sniffImageMime` пропустить сигнатуру, а браузер файл не покаже.
 */
import { crc32, deflateSync } from 'node:zlib';
import { int, prng } from './prng.mts';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type PngSpec = { width: number; height: number; seed: number };

/** Чанк PNG: довжина, тип, дані, crc32(тип + дані). */
function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Колір RGB із PRNG — пастельний діапазон, щоб вітрина не рябіла. */
function color(rand: () => number): [number, number, number] {
  return [int(rand, 90, 230), int(rand, 90, 230), int(rand, 90, 230)];
}

/**
 * Валідний PNG `width × height`: два кольори й візерунок (смуги чи клітинка)
 * з PRNG за `seed` — різні товари отримують помітно різні картинки.
 */
export function pngBytes({ width, height, seed }: PngSpec): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new RangeError('pngBytes: розміри мають бути цілими');
  }
  if (width < 1 || height < 1) throw new RangeError('pngBytes: розмір < 1');

  const rand = prng(seed);
  const base = color(rand);
  const accent = color(rand);
  const cell = int(rand, 8, 32);
  const checker = rand() < 0.5;

  // Рядок = байт фільтра (0 — без фільтра) + RGB на кожен піксель.
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x += 1) {
      const band = Math.floor(x / cell) + (checker ? Math.floor(y / cell) : 0);
      const [r, g, b] = band % 2 === 0 ? base : accent;
      const at = y * stride + 1 + x * 3;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // глибина кольору
  ihdr[9] = 2; // тип кольору: RGB
  // 10–12: стиснення, фільтр, інтерлейс — усі 0 (єдині стандартні значення).

  return new Uint8Array(
    Buffer.concat([
      Buffer.from(SIGNATURE),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', new Uint8Array(0)),
    ]),
  );
}
