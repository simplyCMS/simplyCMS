import { describe, expect, it } from 'vitest';
import {
  MEDIA_ENTITY_TYPES,
  MEDIA_REFERENCED_ENTITY_TYPES,
  REVIEW_MEDIA_ENTITY,
} from 'simplycms/domain/media';

/**
 * Гейт `media-sweep-coverage` (Е6д-22): sweep стирає рядок `media` без
 * референсу, тож тип, чиє посилання `findMediaReferences` не бачить, sweep
 * знищив би разом із живим файлом.
 *
 * Двосторонньо:
 *  - тип, що вантажиться, мусить мати гілку референсу — або стояти в
 *    `NOT_SWEPT` з причиною;
 *  - гілка без типу, що вантажиться, — мертва (або тип пропущено тут).
 *
 * Типи беруться з трьох записувачів (інвентаризація 2026-10-11): адмінський
 * `uploadMedia` (`MEDIA_ENTITY_TYPES`), аватар і фото відгуку. Гілки — з
 * `MEDIA_COLUMNS.entityType` та гілки логотипа, а не з другого ручного списку.
 */
const LOADED_TYPES: readonly string[] = [
  ...MEDIA_ENTITY_TYPES,
  'avatar',
  REVIEW_MEDIA_ENTITY,
];

/** Тип → причина, чому sweep його не покриває. Порожньо: покриті всі. */
const NOT_SWEPT: Record<string, string> = {};

describe('media-sweep-coverage', () => {
  it('кожен тип, що вантажиться, має гілку референсу або явний виняток', () => {
    const uncovered = LOADED_TYPES.filter(
      (t) => !MEDIA_REFERENCED_ENTITY_TYPES.includes(t) && !(t in NOT_SWEPT),
    );
    expect(uncovered).toEqual([]);
  });

  it('кожна гілка референсу відповідає типу, що вантажиться', () => {
    const orphan = MEDIA_REFERENCED_ENTITY_TYPES.filter(
      (t) => !LOADED_TYPES.includes(t),
    );
    expect(orphan).toEqual([]);
  });

  it('виняток не перекриває гілку і не порожній за причиною', () => {
    for (const [type, reason] of Object.entries(NOT_SWEPT)) {
      expect(reason.length).toBeGreaterThan(10);
      expect(MEDIA_REFERENCED_ENTITY_TYPES).not.toContain(type);
      expect(LOADED_TYPES).toContain(type);
    }
  });
});
