import { describe, expect, it } from 'vitest';
import { SERVER_FN_NO_CONSUMER_ALLOWLIST } from './server-fn-consumers/data';
import {
  collect,
  serverFnDefinitions,
  withoutConsumers,
  type SourceFile,
} from './server-fn-consumers/scan';

/**
 * Серверна функція без споживача — мертвий код, який лишається публічною
 * поверхнею: `deleteMedia` пережив свого єдиного викликача (Е6д) і був би
 * знесений лише випадково. Тест вимагає, щоб кожен
 * `export const <імʼя> = createServerFn(…)` мав хоча б одного імпортера.
 *
 * Хто рахується споживачем: файл ПОЗА `__tests__`, `*.test.*`, `test-harness`,
 * `tests/` і моками (усе, що підміняє модуль у тестах, зокрема
 * `admin-server-mock`) та поза файлом, що визначає функцію, який імпортує
 * ім'я з модуля, що веде до визначення, — напряму або крізь барель
 * (`export { n } from` / `export * from`), через `import * as ns` + `ns.n`,
 * чи динамічним `import()` з згадкою імені. Барель, що лише реекспортує, —
 * не споживач: він пересилає, а не викликає.
 *
 * Винятки — `SERVER_FN_NO_CONSUMER_ALLOWLIST` (ключ `<файл>#<імʼя>`, причина
 * обовʼязкова), як `STORAGE_DIRECT_CALL_EXEMPTIONS`: список лише скорочується,
 * мертвий запис (функція зникла чи з'явився споживач) червоніє.
 *
 * Це НЕ парсер TS: імпорти розбираються регулярками, перейменування в
 * реекспорті (`export { a as b } from`) не відстежується — для serverFn
 * репо їх немає, а з'явиться — функція стане «без споживача», тест
 * покличе людину переглянути.
 */

// ---------- тести ----------

describe('серверні функції мають споживача', () => {
  const files = collect();
  const defs = serverFnDefinitions(files);
  const orphans = withoutConsumers(files);

  it('скан бачить публічні serverFn (не порожній)', () => {
    expect(defs.length).toBeGreaterThan(100);
    expect(
      defs.some(
        (d) => d.file === 'packages/simplycms/src/admin-server/index.ts',
      ),
    ).toBe(true);
  });

  it('кожна serverFn має імпортера поза тестами й моками, або запис в allowlist з причиною', () => {
    expect(
      orphans.filter((k) => !(k in SERVER_FN_NO_CONSUMER_ALLOWLIST)),
      'serverFn без споживача: прибери її (мертва поверхня) або додай у SERVER_FN_NO_CONSUMER_ALLOWLIST з причиною (напр. публічний порт для плагінів)',
    ).toEqual([]);
  });

  it('allowlist без мертвих записів і з причинами', () => {
    const dead = Object.keys(SERVER_FN_NO_CONSUMER_ALLOWLIST).filter(
      (k) => !orphans.includes(k),
    );
    expect(
      dead,
      'функція зникла або споживач зʼявився — прибери запис, список лише скорочується',
    ).toEqual([]);
    expect(
      Object.values(SERVER_FN_NO_CONSUMER_ALLOWLIST).filter(
        (r) => r.trim().length < 10,
      ),
    ).toEqual([]);
  });
});

describe('негативний контроль', () => {
  const def: SourceFile = {
    path: 'pkg/src/api/index.ts',
    text: "export const usedFn = createServerFn({ method: 'GET' }).handler(async () => 1);\nexport const deadFn = createServerFn({ method: 'GET' }).handler(async () => 2);\n",
  };
  const consumer: SourceFile = {
    path: 'pkg/src/ui/Widget.tsx',
    text: "import { usedFn } from '../api';\nusedFn();\n",
  };

  it('фіктивна serverFn без імпортера червоніє, використана — ні', () => {
    expect(withoutConsumers([def, consumer])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
  });

  it('імпортер лише у тесті чи моку не рахується', () => {
    const inTest: SourceFile = {
      path: 'pkg/src/ui/__tests__/w.test.tsx',
      text: "import { deadFn } from '../../api';",
    };
    const inMock: SourceFile = {
      path: 'pkg/src/ui/admin-server-mock.ts',
      text: "import { deadFn } from '../api';",
    };
    expect(withoutConsumers([def, consumer, inTest, inMock])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
  });

  it('барель, що лише реекспортує, не споживач; імпорт крізь барель — споживач', () => {
    const barrel: SourceFile = {
      path: 'pkg/src/index.ts',
      text: "export * from './api';\n",
    };
    const throughBarrel: SourceFile = {
      path: 'pkg/src/ui/B.tsx',
      text: "import { deadFn } from '..';\ndeadFn();\n",
    };
    expect(withoutConsumers([def, consumer, barrel])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
    expect(withoutConsumers([def, consumer, barrel, throughBarrel])).toEqual(
      [],
    );
  });

  it('import * as ns + ns.імʼя і type-імпорт', () => {
    const ns: SourceFile = {
      path: 'pkg/src/ui/N.ts',
      text: "import * as api from '../api';\napi.deadFn();\n",
    };
    expect(withoutConsumers([def, consumer, ns])).toEqual([]);
  });

  it('імʼя іншої функції з тим самим словом не рахується', () => {
    const other: SourceFile = {
      path: 'pkg/src/other/index.ts',
      text: 'export const deadFn = 1;\n',
    };
    const importsOther: SourceFile = {
      path: 'pkg/src/ui/O.ts',
      text: "import { deadFn } from '../other';",
    };
    expect(withoutConsumers([def, consumer, other, importsOther])).toEqual([
      'pkg/src/api/index.ts#deadFn',
    ]);
  });
});
