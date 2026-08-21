import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { printNextSteps } from '../packages/create-simplycms-store/src/steps.mjs';
import {
  BUNDLED_SKILLS,
  createSkillLinks,
  linkSkills,
} from '../packages/create-simplycms-store/src/skill-links.mjs';

// Доставка агентних скілів у магазин (трек К0): файли живуть у пакеті
// `simplycms`, магазин отримує СИМЛІНКИ. Копії немає навмисно — форк у
// репозиторії магазину старів би мовчки при оновленні ядра.
const LINK_DIRS = ['.agents/skills', '.claude/skills'];

/** Магазин зі встановленим ядром: стаб теки skills/ у node_modules. */
function makeStore(skills: string[]) {
  const storeRoot = mkdtempSync(join(tmpdir(), 'skill-links-'));
  for (const name of skills) {
    const dir = join(storeRoot, 'node_modules/simplycms/skills', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `# ${name}\n`);
  }
  return storeRoot;
}

describe('create-store: лінки агентних скілів', () => {
  it('createSkillLinks: обидві теки, лінк резолвиться у файл скіла', () => {
    const storeRoot = makeStore(['redesign-from-reference', 'other-skill']);
    const created = createSkillLinks(storeRoot);
    expect(created.length).toBe(4);
    for (const dir of LINK_DIRS) {
      for (const name of ['redesign-from-reference', 'other-skill']) {
        const link = join(storeRoot, dir, name);
        expect(lstatSync(link).isSymbolicLink()).toBe(true);
        // 🔴 Ціль ВІДНОСНА: магазин переносять текою, а абсолютний шлях
        // tmp-теки скаффолду пережив би перенос лише випадково.
        expect(readlinkSync(link)).toBe(
          `../../node_modules/simplycms/skills/${name}`,
        );
        expect(readFileSync(join(link, 'SKILL.md'), 'utf8')).toBe(
          `# ${name}\n`,
        );
      }
    }
  });

  it('createSkillLinks: повторний виклик — не падає й не дублює', () => {
    const storeRoot = makeStore(['redesign-from-reference']);
    expect(createSkillLinks(storeRoot).length).toBe(2);
    expect(createSkillLinks(storeRoot)).toEqual([]);
  });

  it('createSkillLinks: без встановленого ядра — лінки наперед, за BUNDLED_SKILLS', () => {
    const storeRoot = mkdtempSync(join(tmpdir(), 'skill-links-none-'));
    const created = createSkillLinks(storeRoot);
    expect(created.length).toBe(BUNDLED_SKILLS.length * 2);
    const link = join(storeRoot, '.claude/skills', BUNDLED_SKILLS[0]);
    // Лінк є (lstat), але поки що висить у порожнечу (existsSync = false):
    // після `pnpm install` ціль зʼявиться і він оживе сам.
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(existsSync(link)).toBe(false);
  });

  it('createSkillLinks: наявний файл/теку з тим самим іменем не чіпає', () => {
    const storeRoot = makeStore(['redesign-from-reference']);
    const own = join(storeRoot, '.claude/skills/redesign-from-reference');
    mkdirSync(own, { recursive: true });
    writeFileSync(join(own, 'SKILL.md'), '# власний форк\n');
    const created = createSkillLinks(storeRoot);
    expect(created).toEqual(['.agents/skills/redesign-from-reference']);
    expect(readFileSync(join(own, 'SKILL.md'), 'utf8')).toBe(
      '# власний форк\n',
    );
  });

  // 🔴 Windows + пропущений install: junction вимагає ІСНУЮЧОЇ цілі, тож
  // лінків там не робимо взагалі — натомість магазин отримує рядок-підказку
  // в «Наступних кроках». На POSIX лінки створюються одразу й оживають після
  // install самі.
  it('linkSkills: без install — POSIX лінкує, win32 віддає pending', () => {
    const posix = mkdtempSync(join(tmpdir(), 'skill-links-posix-'));
    expect(linkSkills(posix, false)).toEqual({
      created: BUNDLED_SKILLS.flatMap((name) => [
        `.agents/skills/${name}`,
        `.claude/skills/${name}`,
      ]),
      pending: false,
    });

    const store = mkdtempSync(join(tmpdir(), 'skill-links-win-'));
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      expect(linkSkills(store, false)).toEqual({ created: [], pending: true });
      expect(existsSync(join(store, '.claude'))).toBe(false);
    } finally {
      Object.defineProperty(process, 'platform', platform!);
    }
  });

  it('printNextSteps: pending додає рядок про simplycms update', () => {
    let out = '';
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        out += String(chunk);
        return true;
      });
    try {
      printNextSteps({ dirLabel: 'shop', installed: false, hasEnv: true });
      expect(out).not.toContain('лінки агентних скілів');
      printNextSteps({
        dirLabel: 'shop',
        installed: false,
        hasEnv: true,
        skillsPending: true,
      });
    } finally {
      spy.mockRestore();
    }
    expect(out).toContain('simplycms update');
    expect(out).toContain('лінки агентних скілів');
  });
});
