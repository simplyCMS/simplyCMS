import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Негативний контроль dependency-lint межі довіри плагінів (Фаза 3, Р7).
 *
 * 🔴 Зелений `pnpm lint` доводить лише «у чинному коді порушень немає» — він
 * НЕ доводить, що зона налаштована і ловить порушення (правило, що мовчки
 * відвалилось, теж дає зелений лінт). Доводить цей тест: він згодовує ESLint
 * СИНТЕТИЧНЕ порушення з filePath усередині зони й поза нею — той самий
 * прийом, що довів env-контракт (урок сесії 2026-08-13: вакуумний тест
 * зеленіє і після відкату).
 */

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: REPO });
});

async function boundaryErrors(
  code: string,
  filePath: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: join(REPO, filePath),
    warnIgnored: true,
  });
  // Файл, зʼїдений ignores, дав би 0 повідомлень і хибно-зелений тест —
  // тому ігнор зони окремо асертиться в останньому кейсі.
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message);
}

describe('межа довіри плагінів (no-restricted-imports)', () => {
  const violation =
    "import { createServerSupabase } from 'simplycms/supabase/server-client';\n";

  it('ловить пряме імпортування Supabase-шару в plugins/**', async () => {
    const errors = await boundaryErrors(
      violation,
      'plugins/hello-world/fixture.ts',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('plugin-sdk');
  });

  it('ловить у packages/simplycms-plugin-*/** — bare, субшлях і зовнішній пакет', async () => {
    for (const bad of [
      "import { x } from 'simplycms/supabase';",
      "import { y } from 'simplycms/supabase/browser-client';",
      "import { createClient } from '@supabase/supabase-js';",
    ]) {
      const errors = await boundaryErrors(
        bad,
        'packages/simplycms-plugin-faq/src/fixture.ts',
      );
      expect(errors, bad).toHaveLength(1);
    }
  });

  it('ловить обхідні шляхи контуру v2: лоадери, auth, схема, транспорт портів, admin-server', async () => {
    // 🔴 Ці групи додано разом із B9 і не з чистоти: доки єдиним каналом до
    // БД був PostgREST, заборони Supabase вистачало. Тепер поруч живуть
    // серверні лоадери вітрини, auth-контур, Drizzle-схема й сам транспорт
    // портів — кожен віддає плагінові рівно те, що межа довіри забирає.
    // `admin-server`/`admin-server/impl` (Е1б, К3-4′) — той самий клас
    // дірки: кожна операція за `impl` сама кличе requireGrant, але імпорт
    // із плагіна все одно тягне серверний граф у клієнтський бандл.
    for (const bad of [
      "import { withStorefrontDb } from 'simplycms/storefront/loaders';",
      "import { readSessionSubject } from 'simplycms/auth';",
      "import { orders } from 'simplycms/schema';",
      "import { pluginTableList } from 'simplycms/plugin-sdk/server';",
      "import { orderStatusesOps } from 'simplycms/admin-server/impl';",
      "import { adminGrants } from 'simplycms/admin-server';",
      "import { sql } from 'drizzle-orm';",
      "import pg from 'pg';",
    ]) {
      const errors = await boundaryErrors(
        bad,
        'packages/simplycms-plugin-faq/src/fixture.ts',
      );
      expect(errors, bad).toHaveLength(1);
      expect(errors[0], bad).toContain('plugin-sdk');
    }
  });

  it('ті самі обхідні шляхи ловляться і ДИНАМІЧНИМ import()', async () => {
    const [result] = await eslint.lintText(
      "const a = await import('simplycms/storefront/loaders');\n" +
        "const b = await import('simplycms/auth');\n" +
        "const c = await import('simplycms/schema');\n" +
        "const d = await import('simplycms/plugin-sdk/server');\n" +
        "const g = await import('simplycms/admin-server/impl');\n" +
        "const h = await import('simplycms/admin-server');\n" +
        "const e = await import('drizzle-orm');\n" +
        "const f = await import('pg');\n",
      {
        filePath: join(REPO, 'plugins/hello-world/fixture.ts'),
        warnIgnored: true,
      },
    );
    expect(
      (result?.messages ?? []).filter(
        (m) => m.ruleId === 'no-restricted-syntax',
      ),
    ).toHaveLength(8);
  });

  it('НЕ чіпає ядро: той самий імпорт поза зоною чистий', async () => {
    for (const path of [
      'src/fixture.ts',
      'packages/simplycms/src/plugins/fixture.ts',
      'packages/simplycms/src/plugin-sdk/fixture.ts',
    ]) {
      expect(await boundaryErrors(violation, path), path).toEqual([]);
    }
  });

  it('ловить і ДИНАМІЧНИЙ import() у зоні (no-restricted-syntax селектор)', async () => {
    const [result] = await eslint.lintText(
      "const c = await import('simplycms/supabase/server-client');\n" +
        "const d = await import('@supabase/supabase-js');\n",
      {
        filePath: join(REPO, 'plugins/hello-world/fixture.ts'),
        warnIgnored: true,
      },
    );
    const dynamicErrors = (result?.messages ?? []).filter(
      (m) => m.ruleId === 'no-restricted-syntax',
    );
    expect(dynamicErrors).toHaveLength(2);
    // Легальний динамічний import у зоні лишається чистим.
    const [clean] = await eslint.lintText(
      "const m = await import('simplycms/plugin-sdk');\n",
      {
        filePath: join(REPO, 'plugins/hello-world/fixture.ts'),
        warnIgnored: true,
      },
    );
    expect(
      (clean?.messages ?? []).filter(
        (m) => m.ruleId === 'no-restricted-syntax',
      ),
    ).toEqual([]);
  });

  it('дозволена поверхня в зоні чиста: plugin-sdk, ui, react', async () => {
    const errors = await boundaryErrors(
      "import { definePlugin, usePluginTable } from 'simplycms/plugin-sdk';\n" +
        "import { Button } from 'simplycms/ui/button';\n" +
        "import { useState } from 'react';\n",
      'plugins/hello-world/fixture.ts',
    );
    expect(errors).toEqual([]);
  });

  it('похідна від декларації межі: server-only субшляхи й серверні залежності', async () => {
    for (const bad of [
      "import { pool } from 'simplycms/db';",
      "import { ops } from 'simplycms/admin-server/impl';",
      "import { createSelectSchema } from 'drizzle-zod';",
    ]) {
      const errors = await boundaryErrors(
        bad,
        'plugins/hello-world/fixture.ts',
      );
      expect(errors, bad).toHaveLength(1);
    }
  });

  it('зона не зʼїдена ignores (страховка скоупінгу)', async () => {
    expect(
      await eslint.isPathIgnored(join(REPO, 'plugins/hello-world/index.ts')),
    ).toBe(false);
    expect(
      await eslint.isPathIgnored(
        join(REPO, 'packages/simplycms-plugin-faq/src/index.ts'),
      ),
    ).toBe(false);
  });
});
