import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { printNextSteps } from '../packages/create-simplycms-store/src/steps.mjs';
import { distTagFor } from '../scripts/release/dist-tag.mjs';

// Власник бачить у консолі ОДНЕ речення: решту веде агент (скіл онбордингу),
// а довідкові кроки для людини без агента живуть у README магазину. Тест
// стереже обидва боки: консоль не повертається до списку команд, а README
// пакета на npm відкривається входом для агента.
const PKG = 'packages/create-simplycms-store';
const read = (p: string) => readFileSync(p, 'utf8');

function captureNextSteps(args: {
  dirLabel: string;
  skillsPending?: boolean;
}): string {
  let out = '';
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: unknown) => {
      out += String(chunk);
      return true;
    });
  try {
    printNextSteps(args);
  } finally {
    spy.mockRestore();
  }
  // Рамка note і перенос рядків не частина змісту.
  return out
    .replace(/[│┌┐└┘├┤─]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('create-store: фінальне повідомлення', () => {
  it('printNextSteps — одне речення для агента, без списку команд', () => {
    const out = captureNextSteps({ dirLabel: 'my-shop' });
    expect(out).toContain('Магазин створено в my-shop.');
    expect(out).toContain('Claude Code чи Codex');
    expect(out).toContain('«розгорни магазин»');
    for (const forbidden of [
      'psql',
      'cp .env.example',
      'db:apply',
      'owner:invite',
      'MIGRATION_DATABASE_URL',
      'pnpm run dev',
    ])
      expect(out).not.toContain(forbidden);
    expect(out.match(/Відкрийте агента/g)).toHaveLength(1);
  });
});

describe('create-store: README пакета — вхід для агента', () => {
  const readme = read(`${PKG}/README.md`);
  const version = JSON.parse(read(`${PKG}/package.json`)).version as string;

  it('перший розділ після назви — «Для агента: з порожньої теки»', () => {
    const headings = readme.match(/^#{1,2} .+$/gm) ?? [];
    expect(headings[0]).toMatch(/^# create-simplycms-store/);
    expect(headings[1]).toBe('## Для агента: з порожньої теки');
  });

  it('тег у командах створення збігається з npm-тегом версії', () => {
    const tag = distTagFor(version);
    const commands = readme.match(/pnpm create simplycms-store\S*/g) ?? [];
    expect(commands.length).toBeGreaterThan(0);
    // Стабільна версія тега не несе: `@latest` у README не зашивається.
    const expected = tag === 'next' ? 'pnpm create simplycms-store@next' : null;
    for (const command of commands)
      expect(command).toBe(expected ?? 'pnpm create simplycms-store');
  });

  it('не обіцяє, що магазин не шле листів', () => {
    expect(readme).not.toContain('Листів магазин не шле');
  });
});

describe('create-store: README магазину — «Агент і деплой»', () => {
  it('має розділ, що веде до агента й скіла онбордингу', () => {
    const readme = read(`${PKG}/template/README.md`);
    expect(readme).toContain('## Агент і деплой');
    const section = readme.split('## Агент і деплой')[1].split(/^## /m)[0];
    expect(section).toContain('розгорни магазин');
    expect(section).toContain('simplycms-onboarding');
  });
});
