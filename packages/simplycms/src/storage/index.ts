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
  type MediaStorageOptions,
} from './driver';
export { localFsDriver } from './local-fs';
export { s3Driver } from './s3';
export { getMediaDriver, selectMediaDriver } from './select';
export {
  serveMedia,
  type MediaServeVerdict,
  type ServeMediaDeps,
} from './serve';
export { inspectUpload, type UploadInspection } from './inspect';
export {
  completeMediaErasures,
  listMediaErasures,
  MEDIA_ERASURE_RETRY_BATCH,
  retryMediaErasures,
  scheduleMediaErasures,
  type MediaErasure,
} from './erasures';
export {
  findMediaReferences,
  MEDIA_REFERENCED_ENTITY_TYPES,
  mediaReferenceExists,
  type MediaReference,
} from './references';
export {
  eraseMediaRows,
  writeMedia,
  type MediaOwner,
  type MediaRecord,
  type WriteMediaInput,
} from './record';
export { withPublishedRollback } from './rollback';
