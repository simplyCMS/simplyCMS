import { z } from 'zod';
import { dbRoleForSubject, requireGrant } from 'simplycms/auth';
import { withActor } from 'simplycms/db';
import {
  MAX_UPLOAD_BYTES,
  MEDIA_ENTITY_TYPES,
  MEDIA_URL_BASE,
  resolveMediaUrl,
  type MediaEntityType,
} from 'simplycms/domain/media';
import {
  discardMedia,
  eraseMedia,
  inspectUpload,
  writeMedia,
  type MediaMime,
} from 'simplycms/storage';

// 🔴 Allowlist, а не вільний рядок: `entity_type` іде в БД і потім у
// предикати обліку. Сам список живе в T1 (`domain/media`), бо ним же
// типізується пропс `ImageUpload` — копії тут бути не може.
const entityIdSchema = z.uuid().nullable();

export interface ParsedUpload {
  readonly bytes: Uint8Array;
  readonly mime: MediaMime;
  readonly entityType: MediaEntityType;
  readonly entityId: string | null;
}

const REASON_CODE = {
  unsupported_type: 'media/bad-format',
  too_large: 'media/too-large',
} as const;

/**
 * Розбір форми завантаження. Винесено з хендлера окремою чистою функцією
 * саме заради тестів: сам хендлер без сесії й БД не запускається.
 *
 * 🔴 Перевірку ВМІСТУ (магічні байти + ліміт розміру) робить спільний
 * `inspectUpload` із `simplycms/storage`, а не цей модуль. serverFn
 * завантаження два — адмінський і кабінетний — і власний сніфер у кожному
 * був би другою копією правила, яка розійдеться на першому ж новому форматі.
 * Тут лишається те, що справді належить АДМІНСЬКІЙ формі: `entityType` з
 * allowlist і `entityId` як uuid.
 *
 * 🔴 Тексти помилок англійською: це серверна діагностика, яку клієнт мапить
 * у власні рядки каталогу, а не рядок інтерфейсу.
 */
export async function parseUploadForm(data: FormData): Promise<ParsedUpload> {
  const file = data.get('file');
  if (!(file instanceof File)) throw new Error('media/no-file');

  const entityTypeRaw = data.get('entityType');
  if (typeof entityTypeRaw !== 'string') {
    throw new Error('media/no-entity-type');
  }
  const entityType = MEDIA_ENTITY_TYPES.find((t) => t === entityTypeRaw);
  if (!entityType) throw new Error('media/bad-entity-type');

  const entityIdRaw = data.get('entityId');
  const entityId = entityIdSchema.parse(
    typeof entityIdRaw === 'string' && entityIdRaw !== '' ? entityIdRaw : null,
  );

  const checked = await inspectUpload(file, MAX_UPLOAD_BYTES);
  if (!checked.ok) throw new Error(REASON_CODE[checked.reason]);

  return { bytes: checked.bytes, mime: checked.mime, entityType, entityId };
}

/** Завантажити файл від імені адміна. */
export async function uploadMediaOp({
  data,
}: {
  data: FormData;
}): Promise<{ ref: string; url: string }> {
  // 🔴 Перший рубіж — ЗАВЖДИ до withActor (К3-13): `app_admin` вмикається
  // лише після типізованого «так». Кликати `requireGrant` зсередини
  // відкритої транзакції не можна — `readSessionSubject` бере власне
  // зʼєднання, і на вичерпаному пулі це self-deadlock.
  const { subject } = await requireGrant('media.write');
  const parsed = await parseUploadForm(data);

  // 🔴 `written` живе ПОЗА транзакцією — той самий клас відмови, що в
  // `uploadMyAvatar`: якщо COMMIT упаде вже після публікації файлу, rollback
  // прибере рядок, а диск про транзакції не знає, і обʼєкт лишився б орфаном.
  let written: string | null = null;
  try {
    return await withActor(
      { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
      async (db) => {
        const record = await writeMedia(db, {
          bytes: parsed.bytes,
          mime: parsed.mime,
          entityType: parsed.entityType,
          entityId: parsed.entityId,
          uploadedBy: subject.userId,
        });
        written = record.ref;
        const url = resolveMediaUrl(record.ref, MEDIA_URL_BASE);
        // Недосяжно: `mediaKey` не породжує порожнього референсу. Кидок
        // замість `!` тримає межу чесною — тип звужується доказом.
        if (url === null) throw new Error('media/bad-format');
        return { ref: record.ref, url };
      },
    );
  } catch (error) {
    // Best-effort і НЕ маскує первинну помилку: `discardMedia` не кидає.
    if (written !== null) await discardMedia(written);
    throw error;
  }
}

export const deleteMediaInput = z.object({ ref: z.string().min(1).max(200) });

/** Прибрати файл за референсом. Зовнішній URL → `removed: false`, без збою. */
export async function deleteMediaOp({
  data,
}: {
  data: z.infer<typeof deleteMediaInput>;
}): Promise<{ removed: boolean }> {
  const { subject } = await requireGrant('media.write');
  return withActor(
    { role: dbRoleForSubject(subject), userId: subject.userId ?? undefined },
    async (db) => ({ removed: await eraseMedia(db, data.ref) }),
  );
}
