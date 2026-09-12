import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { readPublishableManifests } from '../scripts/release/bump.mjs';

// 🔴 Скаффолдер і CLI обіцяли `>=20`, три інші пакети — нічого, тоді як Start
// у згенерованому магазині вимагає `>=22.12.0`: користувач на Node 20
// проходив `npm create` і падав на першому `pnpm dev`. Поріг пакета не може
// бути нижчим за поріг фреймворку, який цей пакет у магазин приводить.
// Еталон читається зі ВСТАНОВЛЕНОГО Start, а не з константи: бамп Start
// підіймає поріг сам, і тест червоніє замість тихого дрейфу.
// `createRequire` — бо файл ESM: голого `require` у ньому не існує.
const require = createRequire(import.meta.url);
const start = JSON.parse(
  readFileSync(require.resolve('@tanstack/react-start/package.json'), 'utf8'),
) as { engines: { node: string } };

// Порівняння СЕМАНТИЧНЕ, не рядкове: `'>=22.12.0' === floor` зламалось би на
// першому ж бампі Start, а «22.12» одним числом було б МЕНШЕ за «22.9».
// Відсутні компоненти діапазону — нулі (`>=22` ⇒ 22.0.0).
const floor = (range: string): [number, number, number] => {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range);
  if (!match) throw new Error(`не semver-поріг: ${range}`);
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
};

const notBelow = (range: string, reference: string): boolean => {
  const a = floor(range);
  const b = floor(reference);
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

describe('engines.node: не нижче за поріг @tanstack/react-start', () => {
  // 🔴 Набір береться з readPublishableManifests() (той самий дискавер, що й
  // у реліз-бампі), а не списком рядком: точний склад пʼяти пакетів уже
  // стереже tests/release-bump-coverage.test.ts, тож новий пакет потрапляє
  // під пін автоматично, а не мовчки зʼїжджає з порогу. Дискавер читає
  // відносний `packages/` — vitest працює з кореня репо, і саме так той тест
  // його вже кличе (рядок 19).
  it.each(
    readPublishableManifests().map(
      ({ manifest }) =>
        [manifest.name, manifest.engines?.node] as [string, string | undefined],
    ),
  )('%s заявляє поріг і він не нижчий за Start', (name, range) => {
    expect(range, `${name}: engines.node відсутній`).toBeDefined();
    expect(notBelow(range!, start.engines.node)).toBe(true);
  });

  // Шостий поріг — шаблон магазину. Файл із плейсхолдерами, але валідний JSON
  // як є (обидва плейсхолдери стоять ЗНАЧЕННЯМИ рядків), тож підстановка тут
  // не потрібна — так само його читає scripts/pilot-pack/create-pkg-checks.mjs.
  it('шаблон магазину (package.json.tpl) не нижчий за Start', () => {
    const tpl = JSON.parse(
      readFileSync(
        'packages/create-simplycms-store/template/package.json.tpl',
        'utf8',
      ),
    ) as { engines?: { node?: string } };
    expect(tpl.engines?.node).toBeDefined();
    expect(notBelow(tpl.engines!.node!, start.engines.node)).toBe(true);
  });
});
