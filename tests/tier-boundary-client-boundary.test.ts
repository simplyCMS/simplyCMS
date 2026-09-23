import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, eslint } from './tier-boundary/lint';

/**
 * Негативний і позитивний контроль сьомого читача межі клієнт/сервер
 * (`eslint-rules/no-server-only-in-client.mjs`, зона
 * `simplycms-client-boundary/no-server-only-in-client`).
 *
 * Окремий файл, а не додаткові кейси в `tests/tier-boundary.test.ts`: та
 * зона стереже НАПРЯМОК ТІРІВ (`no-restricted-imports`), ця — окремий
 * детектор межі клієнт/сервер поверх `contracts/server-only`; спільний
 * файл переріс би канон 150 рядків.
 */
const RULE_ID = 'simplycms-client-boundary/no-server-only-in-client';

async function ruleErrors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: join(REPO, filePath),
    warnIgnored: true,
  });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === RULE_ID)
    .map((m) => m.message);
}

describe('сьомий читач межі клієнт/сервер (no-server-only-in-client)', () => {
  it('клієнтська тека не сміє імпортувати server-only субшлях', async () => {
    const errors = await ruleErrors(
      "import { withActor } from 'simplycms/db';\n",
      'packages/simplycms/src/checkout-ui/__boundary-fixture.ts',
    );
    expect(errors).toHaveLength(1);
  });

  // 🔴 Позитивний контроль виїмки — важливіший за негативний: без нього
  // зона могла б «працювати», зламавши весь наявний serverFn-шар кабінету.
  it('core/lib СМІЄ імпортувати лоадери — це serverFn-модулі', async () => {
    const errors = await ruleErrors(
      "import { withCustomerDb } from 'simplycms/storefront/loaders';\n",
      'packages/simplycms/src/core/lib/__boundary-fixture.ts',
    );
    expect(errors).toEqual([]);
  });

  it('живий канон Е1а (import type) лишається чистим у зоні admin', async () => {
    const errors = await ruleErrors(
      "import type { OrderStatus } from 'simplycms/schema/types';\n",
      'packages/simplycms/src/admin/pages/__boundary-fixture.tsx',
    );
    expect(errors).toEqual([]);
  });

  it('admin-data не сміє value-імпортувати server-only impl', async () => {
    const errors = await ruleErrors(
      "import { orderStatusesOps } from 'simplycms/admin-server/impl';\n",
      'packages/simplycms/src/admin-data/__boundary-fixture.ts',
    );
    expect(errors).toHaveLength(1);
  });

  it('admin-data СМІЄ import type із server-only impl (К3-9′ п.3)', async () => {
    const errors = await ruleErrors(
      "import type { SubsetInput } from 'simplycms/admin-server/impl';\n",
      'packages/simplycms/src/admin-data/__boundary-fixture.ts',
    );
    expect(errors).toEqual([]);
  });

  it('admin-data СМІЄ value-імпортувати стаб simplycms/admin-server', async () => {
    const errors = await ruleErrors(
      "import { listOrderStatuses } from 'simplycms/admin-server';\n",
      'packages/simplycms/src/admin-data/__boundary-fixture.ts',
    );
    expect(errors).toEqual([]);
  });
});
