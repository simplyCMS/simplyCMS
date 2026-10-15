import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Парність версії `pg` і `nodemailer` (К3-Е8, Task 9): peer ядра ↔ шаблон магазину ↔ пілотний оверлей ↔ корінь монорепо
 * (К3-Е7, Task 11). Драйвер постачає ХОСТ (магазин), ядро його лише очікує: один екземпляр
 * `pg` у магазині — один пул і одна ідентичність типів, а вклеєний у бандл `pg` ламає старт
 * (`UPSTREAM:START-IP-1`). Точний пін має причину: форма помилок драйвера (`.cause` із
 * `code`/`constraint`) перевірена саме на 8.23.1 (`DRZ-1` у реєстрі обходів), тож магазин
 * не може мовчки поїхати на іншу версію.
 */
const ROOT = resolve(import.meta.dirname, '..');
type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const read = (file: string): Manifest =>
  JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as Manifest;

const core = read('packages/simplycms/package.json');
const template = read(
  'packages/create-simplycms-store/template/package.json.tpl',
);
const pilot = read('tests/pilot/store-template/package.json');
const root = read('package.json');

describe.each(['pg', 'nodemailer'] as const)(
  '%s: peer ядра ↔ магазин',
  (pkg) => {
    const peer = core.peerDependencies?.[pkg];

    it('ядро оголошує пакет як peer, а не як власну залежність', () => {
      expect(peer, `peerDependencies.${pkg} відсутній`).toBeTruthy();
      expect(
        core.dependencies?.[pkg],
        `${pkg} лишився в dependencies ядра`,
      ).toBeUndefined();
    });

    it.each([
      ['шаблон магазину', template.dependencies?.[pkg]],
      ['пілотний оверлей', pilot.dependencies?.[pkg]],
      ['корінь монорепо', root.devDependencies?.[pkg]],
      ['devDependencies ядра', core.devDependencies?.[pkg]],
    ])(`%s: версія ${pkg} = peer ядра`, (_label, version) => {
      expect(version, `${pkg} не оголошено`).toBeTruthy();
      expect(version).toBe(peer);
    });

    it('магазин декларує пакет ПРЯМОЮ залежністю (а не лише dev)', () => {
      expect(template.dependencies?.[pkg]).toBeTruthy();
      expect(template.devDependencies?.[pkg]).toBeUndefined();
    });
  },
);
