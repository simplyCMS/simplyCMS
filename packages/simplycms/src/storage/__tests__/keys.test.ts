import { describe, expect, it } from 'vitest';
import { ACCEPTED_IMAGE_MIME } from 'simplycms/domain/media';
import { EXT_BY_MIME, MEDIA_KEY_RE, MIME_BY_EXT, mediaKey } from '../keys';

describe('mediaKey', () => {
  it('форма — <2 hex>/<uuid>.<ext>, шард дорівнює першим двом символам uuid', () => {
    const key = mediaKey('image/png');
    expect(key).toMatch(MEDIA_KEY_RE);
    const [shard, file] = key.split('/');
    expect(file.startsWith(shard)).toBe(true);
  });

  // 🔴 Пін рішення Е2-11: для КОЖНОГО прийнятого MIME ключ, який пише запис,
  // приймає роздача. «Забутий у регексі формат» після виведення альтернації
  // з EXT_BY_MIME неможливий за побудовою — але сам ЛАНЦЮГ виведення
  // розірвати можна (повернути літерал; дати розширення з символом регексу
  // чи у верхньому регістрі), і ловить це саме прогін по всіх MIME, а не
  // по одному png.
  it('mediaKey() відповідає MEDIA_KEY_RE для КОЖНОГО прийнятого MIME', () => {
    for (const mime of ACCEPTED_IMAGE_MIME) {
      expect(mediaKey(mime)).toMatch(MEDIA_KEY_RE);
    }
  });

  it('розширення виводиться з MIME, jpeg → jpg', () => {
    expect(mediaKey('image/jpeg').endsWith('.jpg')).toBe(true);
    expect(mediaKey('image/webp').endsWith('.webp')).toBe(true);
    expect(mediaKey('image/avif').endsWith('.avif')).toBe(true);
    expect(mediaKey('image/gif').endsWith('.gif')).toBe(true);
  });

  it('ключі не повторюються', () => {
    const keys = new Set(
      Array.from({ length: 500 }, () => mediaKey('image/png')),
    );
    expect(keys.size).toBe(500);
  });

  // 🔴 Дві мапи, що мусять лишатись взаємно оберненими, — саме той клас
  // дрейфу, який не падає одразу: забутий формат виявиться тим, що роздача
  // віддасть 404 на файл, який лежить на диску.
  it('EXT_BY_MIME і MIME_BY_EXT взаємно обернені', () => {
    for (const mime of ACCEPTED_IMAGE_MIME) {
      expect(MIME_BY_EXT[EXT_BY_MIME[mime]]).toBe(mime);
    }
    expect(Object.keys(MIME_BY_EXT)).toHaveLength(ACCEPTED_IMAGE_MIME.length);
  });

  it('MEDIA_KEY_RE відбиває traversal і чужі розширення', () => {
    expect('../etc/passwd').not.toMatch(MEDIA_KEY_RE);
    expect('ab/../../etc/passwd').not.toMatch(MEDIA_KEY_RE);
    expect('ab/ab000000-0000-4000-8000-000000000000.svg').not.toMatch(
      MEDIA_KEY_RE,
    );
    expect('ab/ab000000-0000-4000-8000-000000000000.png\n').not.toMatch(
      MEDIA_KEY_RE,
    );
  });
});
