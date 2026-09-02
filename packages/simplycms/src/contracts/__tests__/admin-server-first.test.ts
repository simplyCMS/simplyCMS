import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_SERVER_FIRST } from '../admin-server-first';
import { ENTITY } from '../entities';

describe('реєстр server-first винятків (К3-2)', () => {
  it('колекція не існує для сутності з реєстру', () => {
    const collections = readdirSync(
      join(import.meta.dirname, '../../admin-data/collections'),
    ).map((f) => f.replace(/\.tsx?$/, '').replace(/-/g, '_'));
    for (const name of Object.keys(ADMIN_SERVER_FIRST))
      expect(
        collections,
        `${name} у реєстрі винятків — колекція заборонена`,
      ).not.toContain(name.replace(/([A-Z])/g, '_$1').toLowerCase());
  });

  it('ключі реєстру не суперечать ENTITY-іменам колекцій', () => {
    expect(Object.keys(ADMIN_SERVER_FIRST).length).toBeGreaterThan(0);
    expect(Object.values(ENTITY)).not.toContain('price_validator');
  });
});
