// PNG сіду вітрини (С-5): згенерований кодом файл мусить пройти той самий
// снифер магічних байтів, що й завантаження в адмінці, — інакше сховище чи
// браузер його не приймуть.
import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { sniffImageMime } from 'simplycms/storage';
import { pngBytes } from '../scripts/showcase/png.mts';

/** Чанки PNG: тип + дані + чи збігся crc32 (після 8-байтової сигнатури). */
function chunks(
  bytes: Uint8Array,
): { type: string; data: Buffer; crcOk: boolean }[] {
  const buf = Buffer.from(bytes);
  const out: { type: string; data: Buffer; crcOk: boolean }[] = [];
  for (let at = 8; at < buf.length;) {
    const length = buf.readUInt32BE(at);
    out.push({
      type: buf.toString('latin1', at + 4, at + 8),
      data: buf.subarray(at + 8, at + 8 + length),
      // CRC рахується по типу + даних: битий CRC браузер не покаже.
      crcOk:
        crc32(buf.subarray(at + 4, at + 8 + length)) ===
        buf.readUInt32BE(at + 8 + length),
    });
    at += length + 12;
  }
  return out;
}

describe('pngBytes', () => {
  const png = pngBytes({ width: 40, height: 24, seed: 42 });

  it('починається з сигнатури PNG і проходить sniffImageMime', () => {
    expect([...png.slice(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(sniffImageMime(png)).toBe('image/png');
  });

  it('IHDR → IDAT → IEND, розміри й обсяг пікселів збігаються', () => {
    const list = chunks(png);
    expect(list.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect(list.every((c) => c.crcOk)).toBe(true);
    const ihdr = list[0]!.data;
    expect([ihdr.readUInt32BE(0), ihdr.readUInt32BE(4)]).toEqual([40, 24]);
    // Рядок = байт фільтра + 3 байти RGB на піксель.
    expect(inflateSync(list[1]!.data).length).toBe((40 * 3 + 1) * 24);
  });

  it('детермінований за seed і різний для різних seed', () => {
    expect(pngBytes({ width: 40, height: 24, seed: 42 })).toEqual(png);
    expect(pngBytes({ width: 40, height: 24, seed: 43 })).not.toEqual(png);
  });

  it('відмовляє на некоректних розмірах', () => {
    expect(() => pngBytes({ width: 0, height: 1, seed: 1 })).toThrow(
      RangeError,
    );
    expect(() => pngBytes({ width: 1.5, height: 1, seed: 1 })).toThrow(
      RangeError,
    );
  });
});
