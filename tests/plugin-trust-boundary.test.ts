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

  it('ловить у packages/simplycms-plugin-*/** — усі три заборонені групи', async () => {
    for (const bad of [
      "import { x } from 'simplycms/supabase';",
      "import { y } from 'simplycms/data-supabase/orderRepository';",
      "import { createClient } from '@supabase/supabase-js';",
    ]) {
      const errors = await boundaryErrors(
        bad,
        'packages/simplycms-plugin-faq/src/fixture.ts',
      );
      expect(errors, bad).toHaveLength(1);
    }
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
