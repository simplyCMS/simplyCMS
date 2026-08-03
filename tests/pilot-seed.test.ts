import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HTML_UNSAFE_CHARS,
  SEED_PRODUCTS,
  SEED_SECTIONS,
  seedProductNames,
} from '../scripts/pilot-pack/seed-fixtures.mjs';
import { renderSeedSql } from '../scripts/pilot-pack/seed-sql.mjs';

// Гард детерміністичного сіду пілота (`pnpm pilot:e2e`).
//
// 🔴 Проблема, яку він закриває: Gate B у режимі `--e2e` асертить КОНКРЕТНІ
// назви товарів. Якби SQL і очікування жили окремо, перейменування товару в
// сіді робило б гейт червоним «без причини» — рівно та хвороба, від якої
// e2e-режим і рятує. Тому `supabase/seed.sql` ГЕНЕРУЄТЬСЯ з фікстур, а цей
// тест стереже, що закомічений файл не розійшовся з генератором.

const SEED_PATH = resolve(__dirname, '../supabase/seed.sql');

describe('pilot seed: SQL згенеровано з фікстур', () => {
  it('supabase/seed.sql збігається з рендером фікстур', () => {
    const onDisk = readFileSync(SEED_PATH, 'utf8');
    if (onDisk !== renderSeedSql()) {
      throw new Error(
        'supabase/seed.sql розійшовся з scripts/pilot-pack/seed-fixtures.mjs. ' +
          'Правити SQL руками не можна — перегенеруй: node scripts/pilot-seed.mjs',
      );
    }
    expect(onDisk.length).toBeGreaterThan(0);
  });

  it('сід ідемпотентний — кожен INSERT має ON CONFLICT', () => {
    const sql = readFileSync(SEED_PATH, 'utf8');
    const inserts = sql.match(/insert into/g) ?? [];
    const conflicts = sql.match(/on conflict/g) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    expect(conflicts.length).toBe(inserts.length);
  });
});

describe('pilot seed: фікстури придатні для асертів по HTML', () => {
  it('назви товарів без символів, які React екранує', () => {
    for (const name of seedProductNames()) {
      expect(HTML_UNSAFE_CHARS.test(name), `назва «${name}»`).toBe(false);
    }
  });

  it('назви й slug-и товарів унікальні', () => {
    expect(new Set(seedProductNames()).size).toBe(SEED_PRODUCTS.length);
    expect(new Set(SEED_PRODUCTS.map((p) => p.slug)).size).toBe(
      SEED_PRODUCTS.length,
    );
  });

  it('є щонайменше один featured-товар і кілька кореневих секцій', () => {
    expect(SEED_PRODUCTS.some((p) => p.isFeatured)).toBe(true);
    expect(SEED_SECTIONS.length).toBeGreaterThanOrEqual(2);
  });

  it('кожен товар прив’язаний до наявної секції і має ціну', () => {
    const slugs = new Set(SEED_SECTIONS.map((s) => s.slug));
    for (const product of SEED_PRODUCTS) {
      expect(slugs.has(product.sectionSlug), product.slug).toBe(true);
      expect(product.price, product.slug).toBeGreaterThan(0);
    }
  });
});
