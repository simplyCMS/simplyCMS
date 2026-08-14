import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Generator, getConfig } from '@tanstack/router-generator';
import { physical, rootRoute } from '@tanstack/virtual-file-routes';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Гард здатності, на якій тримається весь Етап C: `physical()` у віртуальному
// конфізі бачить теки ПОЗА `routesDirectory` (у нас — `packages/*/routes`).
// Якщо апстрим колись заборонить вихід за межі теки роутів, цей тест почервоніє
// раніше, ніж зламається збірка магазину.
//
// Тест герметичний: усе живе в `os.tmpdir()`, справжній `src/routeTree.gen.ts`
// не зачіпається.

let tempRoot: string;
let generatedTreePath: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), 'simplycms-virtual-routes-'));

  // <tmp>/app/routes — «магазин», <tmp>/pkg/routes — «пакет ядра» поза ним.
  const routesDirectory = join(tempRoot, 'app', 'routes');
  const packageRoutes = join(tempRoot, 'pkg', 'routes');
  mkdirSync(routesDirectory, { recursive: true });
  mkdirSync(packageRoutes, { recursive: true });

  writeFileSync(
    join(routesDirectory, '__root.tsx'),
    "import { createRootRoute } from '@tanstack/react-router';\n" +
      'export const Route = createRootRoute();\n',
  );
  writeFileSync(
    join(packageRoutes, 'products.tsx'),
    "import { createFileRoute } from '@tanstack/react-router';\n" +
      "export const Route = createFileRoute('/shop/products')({});\n",
  );

  generatedTreePath = join(tempRoot, 'app', 'routeTree.gen.ts');

  const config = getConfig(
    {
      routesDirectory,
      generatedRouteTree: generatedTreePath,
      // Шлях відносний до `routesDirectory` — рівно як у кореневому `routes.ts`.
      virtualRouteConfig: rootRoute('__root.tsx', [
        physical('/shop', '../../pkg/routes'),
      ]),
      tmpDir: join(tempRoot, 'tanstack-tmp'),
      enableRouteTreeFormatting: false,
      disableLogging: true,
    },
    join(tempRoot, 'app'),
  );

  await new Generator({ config, root: join(tempRoot, 'app') }).run();
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('virtual routes: physical() поза routesDirectory', () => {
  it('підхоплює файл роуту з теки за межами routesDirectory', () => {
    const tree = readFileSync(generatedTreePath, 'utf8');
    // Імпорт у дереві мусить ВИХОДИТИ вгору з теки роутів (`../pkg/routes/…`),
    // а не просто містити збіг підрядка десь усередині `routesDirectory`.
    expect(tree).toMatch(/from '[^']*\.\.\/pkg\/routes\/products'/);
  });

  it('дає роуту id з префікса physical(), а не з фізичного шляху', () => {
    const tree = readFileSync(generatedTreePath, 'utf8');
    expect(tree).toContain("'/shop/products'");
  });
});

// Механізм Фази 3: adminRoutes плагіна — ДРУГЕ physical() з файлами, чиї
// запечені id лягають ПІД layout, який приніс перший (пакет ядра). Гард
// доводить: два монтування не колізують, і роут плагіна стає дитиною
// чужого layout за префіксом id — рівно так /admin/faq плагіна faq
// підвішується під layout /admin з @simplycms/admin-routes.
describe('virtual routes: два physical() під спільним layout', () => {
  let treePath: string;

  beforeAll(async () => {
    const routesDirectory = join(tempRoot, 'app2', 'routes');
    const coreRoutes = join(tempRoot, 'core-pkg', 'routes');
    const pluginRoutes = join(tempRoot, 'plugin-pkg', 'routes');
    mkdirSync(routesDirectory, { recursive: true });
    mkdirSync(join(coreRoutes, 'admin'), { recursive: true });
    mkdirSync(join(pluginRoutes, 'admin', 'faq'), { recursive: true });

    writeFileSync(
      join(routesDirectory, '__root.tsx'),
      "import { createRootRoute } from '@tanstack/react-router';\n" +
        'export const Route = createRootRoute();\n',
    );
    // «Ядро»: layout /admin + одна сторінка.
    writeFileSync(
      join(coreRoutes, 'admin.tsx'),
      "import { createFileRoute } from '@tanstack/react-router';\n" +
        "export const Route = createFileRoute('/admin')({});\n",
    );
    writeFileSync(
      join(coreRoutes, 'admin', 'index.tsx'),
      "import { createFileRoute } from '@tanstack/react-router';\n" +
        "export const Route = createFileRoute('/admin/')({});\n",
    );
    // «Плагін»: сторінка під тим самим layout, з іншого пакета.
    writeFileSync(
      join(pluginRoutes, 'admin', 'faq', 'index.tsx'),
      "import { createFileRoute } from '@tanstack/react-router';\n" +
        "export const Route = createFileRoute('/admin/faq/')({});\n",
    );

    treePath = join(tempRoot, 'app2', 'routeTree.gen.ts');
    const config = getConfig(
      {
        routesDirectory,
        generatedRouteTree: treePath,
        virtualRouteConfig: rootRoute('__root.tsx', [
          physical('', '../../core-pkg/routes'),
          physical('', '../../plugin-pkg/routes'),
        ]),
        tmpDir: join(tempRoot, 'tanstack-tmp2'),
        enableRouteTreeFormatting: false,
        disableLogging: true,
      },
      join(tempRoot, 'app2'),
    );
    await new Generator({ config, root: join(tempRoot, 'app2') }).run();
  });

  it('роут плагіна присутній і імпортується зі СВОГО пакета', () => {
    const tree = readFileSync(treePath, 'utf8');
    expect(tree).toContain("'/admin/faq/'");
    expect(tree).toMatch(
      /from '[^']*\.\.\/plugin-pkg\/routes\/admin\/faq\/index'/,
    );
  });

  it('роут плагіна — дитина layout /admin з пакета ядра', () => {
    const tree = readFileSync(treePath, 'utf8');
    // У дереві дітей layout-роуту /admin має бути і сторінка ядра, і
    // сторінка плагіна — обидві за префіксом id, попри різні physical().
    const adminChildren = tree.match(/AdminRouteChildren[^{]*\{[^}]*\}/)?.[0];
    expect(adminChildren).toBeTruthy();
    expect(adminChildren).toContain('AdminFaqIndexRoute');
    expect(adminChildren).toContain('AdminIndexRoute');
  });
});
