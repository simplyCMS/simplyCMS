import { describe, expect, it } from 'vitest';
import { GALLERY_ORDER } from 'simplycms/translations';
import { GALLERY_ORDER as LIVE_SMOKE_ORDER } from '../scripts/live-smoke/admin-sql.mjs';

// М1 Task 17 fix-1 (M6): live-smoke звіряє галерею картки сирим SQL (`.mjs` не імпортує
// TS-модуль пакета), тож порядок там — копія канону `gallery.ts`. Парність тримає цей тест:
// інший порядок у скрипті дав би хибне «картка ≠ БД» або пропустив би справжню розбіжність.
describe('порядок галереї: live-smoke ↔ канон simplycms/translations', () => {
  it('однаковий', () => {
    expect(LIVE_SMOKE_ORDER).toBe(GALLERY_ORDER);
  });
});
