import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_BUNDLED,
  bundledPackages,
  checkRequestContextSingle,
  checkServerBundle,
  packageOfModule,
} from '../scripts/pilot-pack/server-bundle.mjs';
import { SERVER_BUNDLE_ALLOWLIST } from '../scripts/pilot-pack/server-bundle-allowlist.mjs';

/**
 * Gate SB (К3-Е7, Task 11): логіка перевірки серверного бандла скретча.
 * Реальні дані дає `pnpm pilot:pack` (`bundle-stats.ssr.json`); тут — поведінка
 * на синтетичних зрізах, щоб кожну гілку червоніння було видно без збірки.
 */
const mod = (pkgPath: string) =>
  `/tmp/store/node_modules/.pnpm/${pkgPath.replace('/node_modules/', '@1.0.0/node_modules/')}`;
const stats = (...ids: string[]) => ({ 'a.js': { modules: ids } });
const ALLOW = { zod: 'ESM-only', '@scope/pkg': 'ESM-only' };

describe('packageOfModule', () => {
  it('бере останній node_modules і вміє scoped', () => {
    expect(
      packageOfModule('/s/node_modules/.pnpm/pg@8/node_modules/pg/lib/x.js'),
    ).toBe('pg');
    expect(
      packageOfModule(
        '\0/s/node_modules/.pnpm/a@1/node_modules/@scope/pkg/index.js?x',
      ),
    ).toBe('@scope/pkg');
    expect(packageOfModule('/s/src/server.ts')).toBeNull();
  });
});

describe('checkServerBundle', () => {
  it('зелений, коли всі вклеєні пакети в allowlist, а драйвера немає', () => {
    const r = checkServerBundle(
      stats(
        mod('zod/node_modules/zod/index.js'),
        mod('@scope/node_modules/@scope/pkg/a.js'),
      ),
      ALLOW,
    );
    expect(r.ok, r.details.join('\n')).toBe(true);
  });

  it('МУТАЦІЯ: вклеєний pg — червоний, навіть якщо його вписано в allowlist', () => {
    const s = stats(
      mod('zod/node_modules/zod/index.js'),
      mod('pg/node_modules/pg/lib/index.js'),
    );
    expect(checkServerBundle(s, ALLOW).ok).toBe(false);
    expect(checkServerBundle(s, { ...ALLOW, pg: 'хочу' }).ok).toBe(false);
  });

  it.each([
    'pg',
    'pg-pool',
    'pg-protocol',
    'pg-types',
    'pgpass',
    'postgres-array',
  ])('драйверна сім’я %s заборонена', (name) =>
    expect(FORBIDDEN_BUNDLED.test(name)).toBe(true),
  );

  it.each(['pgx', 'page', 'postgres', 'zod'])('%s — не драйвер', (name) =>
    expect(FORBIDDEN_BUNDLED.test(name)).toBe(false),
  );

  it('невідомий вклеєний пакет без причини — червоний', () => {
    const r = checkServerBundle(
      stats(
        mod('zod/node_modules/zod/index.js'),
        mod('evil/node_modules/evil/i.js'),
      ),
      ALLOW,
    );
    expect(r.ok).toBe(false);
    expect(r.details.join('\n')).toContain('evil');
  });

  it('застарілий запис allowlist (пакета в бандлі немає) — червоний', () => {
    const r = checkServerBundle(
      stats(mod('zod/node_modules/zod/index.js')),
      ALLOW,
    );
    expect(r.ok).toBe(false);
    expect(r.details.join('\n')).toContain('@scope/pkg');
  });

  it('bundledPackages дедуплікує пакети по чанках', () => {
    expect(
      bundledPackages({
        'a.js': { modules: [mod('zod/node_modules/zod/a.js')] },
        'b.js': { modules: [mod('zod/node_modules/zod/b.js')] },
      }),
    ).toEqual(['zod']);
  });
});

describe('SERVER_BUNDLE_ALLOWLIST', () => {
  it('кожен запис має змістовну причину і не є драйвером', () => {
    for (const [name, reason] of Object.entries(SERVER_BUNDLE_ALLOWLIST)) {
      expect(reason.length, name).toBeGreaterThanOrEqual(8);
      expect(FORBIDDEN_BUNDLED.test(name), name).toBe(false);
    }
  });
});

describe('checkRequestContextSingle (Д6)', () => {
  const RC =
    '/s/node_modules/.pnpm/simplycms@1/node_modules/simplycms/dist/site/request-context.js';

  it('зелений: модуль рівно в одному чанку', () => {
    const r = checkRequestContextSingle({
      'a.js': { modules: [RC, '/s/src/other.ts'] },
      'b.js': { modules: ['/s/src/x.ts'] },
    });
    expect(r.ok, r.details.join('\n')).toBe(true);
  });

  it('МУТАЦІЯ: другий id тієї ж логіки (симлінк чи query) — червоний', () => {
    expect(
      checkRequestContextSingle({
        'a.js': { modules: [RC] },
        'b.js': {
          modules: ['/s/packages/simplycms/dist/site/request-context.js'],
        },
      }).ok,
    ).toBe(false);
    expect(
      checkRequestContextSingle({
        'a.js': { modules: [RC, `${RC}?v=1`] },
      }).ok,
    ).toBe(false);
  });

  it('модуля в бандлі немає — червоний', () => {
    expect(
      checkRequestContextSingle({ 'a.js': { modules: ['/s/src/x.ts'] } }).ok,
    ).toBe(false);
  });

  it('суміжні файли (cache-generations) не рахуються', () => {
    const r = checkRequestContextSingle({
      'a.js': {
        modules: [
          RC,
          '/s/node_modules/simplycms/dist/site/cache-generations.js',
        ],
      },
    });
    expect(r.ids).toHaveLength(1);
  });
});
