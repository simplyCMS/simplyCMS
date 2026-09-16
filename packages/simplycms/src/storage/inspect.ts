import { MAX_UPLOAD_BYTES } from 'simplycms/domain/media';
import type { MediaMime } from './keys';
import { sniffImageMime } from './mime';

/**
 * Результат перевірки завантаженого файлу.
 *
 * 🔴 `ok`-дискримінант, а не `'reason' in result`: звуження читається
 * однозначно й не ламається від першого ж додаткового поля в успішній
 * гілці. Домашній патерн — `OrderCancelResult`
 * (`storefront-routes/server/profile-orders.ts`).
 *
 * 🔴 Причина — КОДОМ, не текстом: текст належить каталогу повідомлень, а
 * серверний хендлер живе поза React і транслятора не має.
 */
export type UploadInspection =
  | { ok: true; bytes: Uint8Array; mime: MediaMime; size: number }
  | { ok: false; reason: 'unsupported_type' | 'too_large' };

/**
 * Прочитати файл і вирішити, чи його можна прийняти.
 *
 * 🔴 `mime` — з СИГНАТУРИ файлу, ніколи з `file.type` і ніколи з
 * розширення: обидва задає той, хто вантажить. `payload.php.png` із
 * `type: image/png` пройшов би обидві «перевірки».
 *
 * 🔴 Розмір звіряється ДО читання в памʼять: Start буферизує тіло цілком,
 * тож читати 50 МБ заради відмови — марна алокація.
 */
export async function inspectUpload(
  file: File,
  maxBytes: number = MAX_UPLOAD_BYTES,
): Promise<UploadInspection> {
  if (file.size > maxBytes) return { ok: false, reason: 'too_large' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime) return { ok: false, reason: 'unsupported_type' };

  return { ok: true, bytes, mime, size: bytes.byteLength };
}
