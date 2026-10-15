import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { scaffold } from '../../packages/create-simplycms-store/src/scaffold.mjs';

// Магазин зі «встановленим» ядром для тестів CLI (doctor №17, status). Ядро у
// `node_modules/simplycms` — фейк із СПРАВЖНІМ `contracts/semver` (три TS-файли
// транспільовано): саме npm-вирівняне пререліз-правило робить кейси №17 змістовними.
export const CORE = '1.0.0-rc.1';
export const CLI_INDEX = join(process.cwd(), 'packages/cli/src/index.mjs');
export const STORE_ENV = {
  DATABASE_URL: 'postgresql://app_runtime:pw@localhost:5432/postgres',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
};

export function installFakeCore(store: string) {
  const dir = join(store, 'node_modules/simplycms');
  mkdirSync(join(dir, 'semver'), { recursive: true });
  mkdirSync(join(dir, 'agent'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'simplycms',
      version: CORE,
      type: 'module',
      exports: {
        './env': { import: './env.mjs' },
        './contracts/semver': { import: './semver/index.mjs' },
      },
    }),
  );
  writeFileSync(
    join(dir, 'env.mjs'),
    `export const isProductionRuntime = () => false;
export const resolveDriverEnv = () => ({ mail: { driver: 'smtp' } });
`,
  );
  // Вступ — справжній файл ядра: status --hook читає саме його.
  writeFileSync(
    join(dir, 'agent/intro.md'),
    readFileSync('packages/simplycms/agent/intro.md', 'utf8'),
  );
  const src = join(process.cwd(), 'packages/simplycms/src/contracts/semver');
  for (const name of ['index', 'version', 'core-range']) {
    const out = ts
      .transpileModule(readFileSync(join(src, `${name}.ts`), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replace(/from '\.\/([\w-]+)'/g, "from './$1.mjs'");
    writeFileSync(join(dir, 'semver', `${name}.mjs`), out);
  }
}

/** Скаффолд шаблону магазину з фейковим ядром; теку тимчасову реєструє в `roots` для прибирання. */
export async function scaffoldFakeStore(name: string, roots: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'cli-store-'));
  roots.push(root);
  const target = join(root, name);
  await scaffold({
    templateDir: 'packages/create-simplycms-store/template',
    targetDir: target,
    storeName: name,
    version: CORE,
  });
  installFakeCore(target);
  return target;
}
