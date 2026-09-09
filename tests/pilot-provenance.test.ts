import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCorePackages } from '../scripts/pilot-pack/lockfile-scan.mjs';
import { assertTarballProvenance } from '../scripts/pilot-pack/provenance.mjs';

// Гард існує через мовчазний режим відмови: у реєстрі лежить та сама версія,
// що й у tarball-ах, тож зламаний механізм overrides дав би ЗЕЛЕНИЙ пілот,
// який перевірив опубліковані пакети замість тих, що йдуть на публікацію.

const CORE = ['@simplycms/objects', '@simplycms/ui'];

/** Реальна топологія після К0: unscoped-флагман + scoped-сателіти. */
const TOPOLOGY_5 = [
  'simplycms',
  '@simplycms/cli',
  '@simplycms/theme-solarstore',
  '@simplycms/plugin-faq',
  'create-simplycms-store',
];

/** Мінімальний lockfile pnpm 9 у формі, яку пише pnpm 11.20. */
const lockfile = (packagesBlock: string) => `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    dependencies:
      '@simplycms/objects':
        specifier: file:/tmp/tarballs/simplycms-objects-0.2.1.tgz
        version: file:/tmp/tarballs/simplycms-objects-0.2.1.tgz

packages:
${packagesBlock}
snapshots: {}
`;

const FROM_TARBALLS = `
  '@simplycms/objects@file:../../tarballs/simplycms-objects-0.2.1.tgz':
    resolution: {integrity: sha512-aaa, tarball: file:../../tarballs/simplycms-objects-0.2.1.tgz}
  '@simplycms/ui@file:../../tarballs/simplycms-ui-0.2.1.tgz':
    resolution: {integrity: sha512-bbb}
  react@19.2.4:
    resolution: {integrity: sha512-ccc}
`;

describe('pilot: провенанс tarball-ів у скретчі', () => {
  it('усі пакети ядра з file: — гард зелений', () => {
    const { entries, fromRegistry } = parseCorePackages(
      lockfile(FROM_TARBALLS),
      CORE,
    );
    expect([...entries.keys()].sort()).toEqual(CORE);
    expect(fromRegistry).toEqual([]);
  });

  // Головний сценарій: overrides мовчки не спрацювали, пакет приїхав з npmjs.
  it('пакет із реєстру ловиться і називається', () => {
    const { fromRegistry } = parseCorePackages(
      lockfile(`
  '@simplycms/objects@file:../../tarballs/simplycms-objects-0.2.1.tgz':
    resolution: {integrity: sha512-aaa}
  '@simplycms/ui@0.2.1':
    resolution: {integrity: sha512-bbb}
`),
      CORE,
    );
    expect(fromRegistry).toEqual(['@simplycms/ui@0.2.1']);
  });

  // Два капкани розбору ключа одночасно: суфікс peer-залежностей (буває
  // вкладений) і `@` УСЕРЕДИНІ file:-шляху. Будь-яка евристика на indexOf/
  // lastIndexOf ламається щонайменше на одному з них — тому ім'я береться
  // збігом за відомим переліком, а не пошуком роздільника.
  it('peer-суфікс і @ у шляху tarball-а не збивають розбір', () => {
    const { entries, fromRegistry } = parseCorePackages(
      lockfile(`
  '@simplycms/objects@file:../../@build/t/o.tgz(react@19.2.4)':
    resolution: {integrity: sha512-aaa}
  '@simplycms/ui@0.2.1(react@19.2.4)(zod@4.3.6)':
    resolution: {integrity: sha512-bbb}
`),
      CORE,
    );
    expect([...entries.keys()].sort()).toEqual(CORE);
    expect(entries.get('@simplycms/objects')).toBe(
      'file:../../@build/t/o.tgz(react@19.2.4)',
    );
    expect(fromRegistry).toEqual([
      '@simplycms/ui@0.2.1(react@19.2.4)(zod@4.3.6)',
    ]);
  });

  // Новий пакет ядра, про який пілот не знає, не має проскочити мовчки:
  // саме він міг би приїхати з реєстру повз overrides.
  it('пакет зі scope ядра поза переліком спакованих — ловиться', () => {
    const { unknown, fromRegistry } = parseCorePackages(
      lockfile(`
  '@simplycms/objects@file:../../t/o.tgz':
    resolution: {integrity: sha512-aaa}
  '@simplycms/ui@file:../../t/u.tgz':
    resolution: {integrity: sha512-bbb}
  '@simplycms/brand-new@0.2.1':
    resolution: {integrity: sha512-ccc}
`),
      CORE,
    );
    expect(unknown).toEqual(['@simplycms/brand-new@0.2.1']);
    expect(fromRegistry).toEqual([]);
  });

  // 🔴 Топологія 5 (трек К0): ядро — unscoped `simplycms` плюс scoped-сателіти.
  // Перелік scope-ів, зібраний із самих імен, unscoped-флагман давав би
  // порожнім — і пакет мовчки випадав би з перевірки провенансу.
  it('unscoped-флагман не ігнорується: file: розпізнано, реєстр спіймано', () => {
    const { entries, fromRegistry } = parseCorePackages(
      lockfile(`
  simplycms@file:../../tarballs/simplycms-0.4.0.tgz:
    resolution: {integrity: sha512-aaa}
  '@simplycms/cli@0.4.0':
    resolution: {integrity: sha512-bbb}
`),
      TOPOLOGY_5,
    );
    expect(entries.get('simplycms')).toBe(
      'file:../../tarballs/simplycms-0.4.0.tgz',
    );
    expect(fromRegistry).toEqual(['@simplycms/cli@0.4.0']);
  });

  // 🔴 Дзеркальний капкан: unscoped-імʼя не можна відбирати ПРЕФІКСОМ. Сторонні
  // пакети конвенційно звуться `simplycms-theme-*`/`simplycms-plugin-*`, тож
  // префікс `simplycms` затягнув би їх у `unknown` — і гард червонів би на
  // геть здоровому магазині з чужою темою з реєстру.
  it('сторонній simplycms-theme-* із реєстру не вважається пакетом ядра', () => {
    const { entries, fromRegistry, unknown } = parseCorePackages(
      lockfile(`
  simplycms@file:../../tarballs/simplycms-0.4.0.tgz:
    resolution: {integrity: sha512-aaa}
  'simplycms-theme-aurora@1.2.0':
    resolution: {integrity: sha512-bbb}
  'simplycms-plugin-crm@0.9.0':
    resolution: {integrity: sha512-ccc}
`),
      TOPOLOGY_5,
    );
    expect([...entries.keys()]).toEqual(['simplycms']);
    expect(unknown).toEqual([]);
    expect(fromRegistry).toEqual([]);
  });

  // Секція snapshots повторює ті самі ключі — рахувати треба лише packages:,
  // інакше кожен пакет подвоївся б, а звіт став би брехливим.
  it('секція snapshots не потрапляє в підрахунок', () => {
    const source = `lockfileVersion: '9.0'

packages:

  '@simplycms/objects@file:../../t/o.tgz':
    resolution: {integrity: sha512-aaa}

snapshots:

  '@simplycms/ui@0.2.1':
    dependencies: {}
`;
    const { entries } = parseCorePackages(source, CORE);
    expect([...entries.keys()]).toEqual(['@simplycms/objects']);
  });

  it('порожній перелік пакетів ядра — гард НЕ зеленіє вхолосту', () => {
    const store = mkdtempSync(join(tmpdir(), 'prov-'));
    writeFileSync(
      join(store, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.2.4' } }),
    );
    writeFileSync(join(store, 'pnpm-lock.yaml'), lockfile(FROM_TARBALLS));

    const result = assertTarballProvenance(store, CORE);
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toContain('жодного пакета ядра');
  });

  it('оголошений у манифесті пакет відсутній у lockfile — падіння', () => {
    const store = mkdtempSync(join(tmpdir(), 'prov-'));
    writeFileSync(
      join(store, 'package.json'),
      JSON.stringify({
        dependencies: {
          '@simplycms/objects': '0.2.1',
          '@simplycms/ui': '0.2.1',
        },
      }),
    );
    writeFileSync(
      join(store, 'pnpm-lock.yaml'),
      lockfile(`
  '@simplycms/objects@file:../../t/o.tgz':
    resolution: {integrity: sha512-aaa}
`),
    );

    const result = assertTarballProvenance(store, CORE);
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toContain('@simplycms/ui');
  });

  it('нерозпізнаний пакет ядра валить гейт, а не лише парсер', () => {
    const store = mkdtempSync(join(tmpdir(), 'prov-'));
    writeFileSync(
      join(store, 'package.json'),
      JSON.stringify({
        dependencies: {
          '@simplycms/objects': '0.2.1',
          '@simplycms/ui': '0.2.1',
        },
      }),
    );
    writeFileSync(
      join(store, 'pnpm-lock.yaml'),
      lockfile(`${FROM_TARBALLS}  '@simplycms/brand-new@0.2.1':
    resolution: {integrity: sha512-ddd}
`),
    );

    const result = assertTarballProvenance(store, CORE);
    expect(result.ok).toBe(false);
    expect(result.details.join('\n')).toContain('@simplycms/brand-new');
  });

  it('повний зелений шлях: оголошені пакети присутні й усі з tarball-ів', () => {
    const store = mkdtempSync(join(tmpdir(), 'prov-'));
    writeFileSync(
      join(store, 'package.json'),
      JSON.stringify({
        dependencies: {
          '@simplycms/objects': '0.2.1',
          '@simplycms/ui': '0.2.1',
          react: '^19.2.4',
        },
      }),
    );
    writeFileSync(join(store, 'pnpm-lock.yaml'), lockfile(FROM_TARBALLS));

    const result = assertTarballProvenance(store, CORE);
    expect(result.ok).toBe(true);
    expect(result.details.join('\n')).toContain('2');
  });
});
