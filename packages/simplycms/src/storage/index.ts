// Порт сховища файлів — server-only піддерево (`contracts/server-only`).
//
// 🔴 Клієнту звідси НЕ ПОТРІБНО нічого: резолв URL живе в
// `simplycms/domain/media` (T1, чистий), а запис і видалення — серверні
// операції за serverFn. Саме тому все піддерево в `SERVER_ONLY`.
export { DEFAULT_MEDIA_ROOT, mediaRoot } from './env';
export { MEDIA_KEY_RE, MIME_BY_EXT, mediaKey, type MediaMime } from './keys';
export { sniffImageMime } from './mime';
export {
  MediaKeyCollisionError,
  MediaKeyError,
  type MediaObject,
  type MediaStorageDriver,
} from './driver';
export { getMediaDriver, localFsDriver } from './local-fs';
export { inspectUpload, type UploadInspection } from './inspect';
export {
  discardMedia,
  eraseMedia,
  writeMedia,
  type MediaRecord,
  type WriteMediaInput,
} from './record';
