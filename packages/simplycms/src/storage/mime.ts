import type { MediaMime } from './keys';

/**
 * MIME за МАГІЧНИМИ БАЙТАМИ, а не за розширенням і не за `file.type`.
 *
 * 🔴 Обидва альтернативні джерела задає клієнт: розширення — це кінець імені
 * файлу, `file.type` — заголовок, який браузер бере з того ж розширення.
 * Тобто `payload.php.png` із `type: image/png` пройшов би обидві перевірки.
 * Байти підмінити не можна — вони і є вміст.
 */
export function sniffImageMime(bytes: Uint8Array): MediaMime | null {
  // 🔴 Поріг — 8, а не 12: це довжина найдовшої сигнатури, яку перевіряємо
  // БЕЗ зсуву (PNG). Сигнатури зі зсувом (WebP/AVIF) читають байти 8-11 —
  // при коротшому вході порівняння просто не збігається (undefined !==
  // очікуваний байт), винятку це не кидає.
  if (bytes.length < 8) return null;

  const at = (offset: number, ...expected: number[]): boolean =>
    expected.every((byte, i) => bytes[offset + i] === byte);

  const ascii = (offset: number, text: string): boolean =>
    at(offset, ...Array.from(text, (c) => c.charCodeAt(0)));

  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'image/gif';
  // RIFF-контейнер несе не лише WebP (ще й WAVE, AVI) — бренд на зсуві 8
  // обовʼязковий.
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  // ISO-BMFF: розмір бокса (4 байти) → 'ftyp' → бренд.
  if (ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis')))
    return 'image/avif';

  return null;
}
