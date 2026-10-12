// Е8-Р4: жодна плагінна міграція не сортується ПЕРЕД `0002_grants.sql`.
// Накат іде за порядком імен, а `0002_grants` робить `revoke all on all
// tables … from public`: плагінна таблиця, створена до нього, мовчки втрачала б
// свої `grant` — і перший же запит вітрини падав би `permission denied`.
// Шаблон плагіна колись клав `0001_plg_<name>_init.sql` саме з цією дірою.
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  scaffoldPlugin,
  templatePluginDir,
} from '../packages/cli/src/create-scaffold.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const GRANTS = '0002_grants.sql';

const sqlIn = (dir: string): string[] => {
  try {
    return readdirSync(dir).filter((name) => /_plg_.*\.sql$/.test(name));
  } catch {
    return [];
  }
};

/** Теки з плагінними міграціями: пакет FAQ, плагіни шаблону магазину, скаффолд. */
function pluginMigrationNames(): { source: string; name: string }[] {
  const out: { source: string; name: string }[] = [];
  const add = (source: string, dir: string) =>
    sqlIn(dir).forEach((name) => out.push({ source, name }));

  add('plugin-faq', join(ROOT, 'packages/simplycms-plugin-faq/migrations'));
  const pluginsDir = join(
    ROOT,
    'packages/create-simplycms-store/template/plugins',
  );
  for (const plugin of readdirSync(pluginsDir))
    add(`template/plugins/${plugin}`, join(pluginsDir, plugin, 'migrations'));

  const target = join(mkdtempSync(join(tmpdir(), 'plg-order-')), 'order-check');
  const created = scaffoldPlugin({
    templateDir: templatePluginDir(),
    targetDir: target,
    pluginName: 'order-check',
    coreRange: '>=0.3.0',
  });
  for (const rel of created.filter((r) => r.startsWith('migrations/')))
    out.push({ source: 'scaffold', name: rel.slice('migrations/'.length) });
  return out;
}

describe('плагінні міграції: порядок накату відносно 0002_grants', () => {
  const names = pluginMigrationNames();

  it('перевірка не порожня: скаффолд і plugin-faq присутні', () => {
    const sources = names.map((n) => n.source);
    expect(sources).toContain('scaffold');
    expect(sources).toContain('plugin-faq');
  });

  it.each(names)(
    '$source: $name сортується після 0002_grants.sql',
    ({ name }) => {
      expect([name, GRANTS].sort()[0]).toBe(GRANTS);
      expect(name).toMatch(/^\d{14}_plg_[a-z0-9_]+\.sql$/);
    },
  );
});
