// Тести скілів магазину (`packages/simplycms/skills/simplycms-*`): скіл, що
// кличе неіснуючу команду чи посилається на відсутній файл, брехав би агентові
// у магазині. Охоплює ВСІ скіли, а не вибірку: новий скіл підпадає під правила
// автоматично.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../packages/cli/src/commands.mjs';
import {
  MigrationChecksumError,
  UnjournaledDatabaseError,
} from '../packages/simplycms/src/migrate/errors';

const ROOT = process.cwd();
const SKILLS_DIR = join(ROOT, 'packages/simplycms/skills');
const INTRO = join(ROOT, 'packages/simplycms/agent/intro.md');
const TEMPLATE_DIR = join(ROOT, 'packages/create-simplycms-store/template');
const TEMPLATE_PKG = join(TEMPLATE_DIR, 'package.json.tpl');
/** Вбудовані команди pnpm, які скіли вправі згадувати. */
const PNPM_BUILTIN = ['install', 'up', 'add', 'exec', 'create', 'dlx'];

/** Збіги з `simplycms-<слово>`, що не є скілами: npm-пакет і ключ localStorage. */
const NOT_SKILLS = ['simplycms-store', 'simplycms-cart'];

const skillNames = readdirSync(SKILLS_DIR)
  .filter((n) => n.startsWith('simplycms-'))
  .sort();

/** Усі файли теки рекурсивно (шляхи відносно її кореня). */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? walk(full, base)
      : [relative(base, full)];
  });
}

/** Тексти скіла: SKILL.md і весь `references/` (усі файли, не вибірка). */
function texts(name: string): { file: string; text: string }[] {
  const dir = join(SKILLS_DIR, name);
  return walk(dir)
    .filter((f) => f === 'SKILL.md' || /^references\/.*\.md$/.test(f))
    .map((file) => ({
      file: `${name}/${file}`,
      text: readFileSync(join(dir, file), 'utf8'),
    }));
}

const allTexts = skillNames.flatMap(texts);
const templateScripts = Object.keys(
  JSON.parse(readFileSync(TEMPLATE_PKG, 'utf8')).scripts,
);

describe('скіли магазину: форма', () => {
  it('скіли етапу на місці (новий скіл не вимагає правки тесту)', () => {
    expect(skillNames).toEqual(
      expect.arrayContaining([
        'simplycms-diagnose',
        'simplycms-onboarding',
        'simplycms-redesign',
        'simplycms-update',
      ]),
    );
  });

  it.each(skillNames)(
    '%s: frontmatter name = ім’я теки, description, ## Межі, ≤150 рядків',
    (name) => {
      const text = readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
      const front = /^---\n([^]*?)\n---\n/.exec(text)?.[1] ?? '';
      expect(front).toMatch(new RegExp(`^name: ${name}$`, 'm'));
      expect(front).toMatch(/^description: \S/m);
      expect(text).toMatch(/^## Межі/m);
      expect(text.trimEnd().split('\n').length).toBeLessThanOrEqual(150);
    },
  );
});

describe('скіли магазину: посилання на існуюче', () => {
  it('кожна `simplycms <cmd>` — ключ COMMANDS', () => {
    const used: string[] = [];
    for (const { file, text } of allTexts) {
      // Голе `simplycms <cmd>` — лише в блоках коду: у прозі «simplycms» — назва.
      const fenced = [...text.matchAll(/```[^\n]*\n([^]*?)```/g)].map(
        (m) => m[1],
      );
      for (const m of text.matchAll(
        /(?:pnpm\s+(?:exec\s+)?|\.bin\/|`)simplycms\s+([a-z][\w:-]*)/g,
      ))
        used.push(`${file}: ${m[1]}`);
      for (const block of fenced)
        for (const m of block.matchAll(
          /(?:^|[\s$;&|(])simplycms\s+([a-z][\w:-]*)/gm,
        ))
          used.push(`${file}: ${m[1]}`);
    }
    expect(used.length).toBeGreaterThan(0);
    const unknown = used.filter(
      (u) => !Object.hasOwn(COMMANDS, u.split(': ')[1]),
    );
    expect(unknown).toEqual([]);
  });

  it('кожен `pnpm <script>` — скрипт шаблону, bin simplycms або вбудована команда', () => {
    const unknown: string[] = [];
    for (const { file, text } of allTexts) {
      for (const m of text.matchAll(/\bpnpm\s+([a-z][\w:-]*)/g)) {
        const word = m[1];
        if (
          word !== 'simplycms' &&
          !PNPM_BUILTIN.includes(word) &&
          !templateScripts.includes(word)
        )
          unknown.push(`${file}: pnpm ${word}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it.each(skillNames)(
    '%s: кожен шлях references/scripts/scripts-монорепо у SKILL.md і references/*.md існує',
    (name) => {
      // Шлях із префіксом `simplycms-<інший>/` — посилання на сусідній скіл.
      const dead: string[] = [];
      for (const { file, text } of texts(name)) {
        for (const m of text.matchAll(
          /(?<![\w.-])(?:(simplycms-[a-z]+)\/)?((?:references|scripts)\/[\w./-]+\.(?:md|mjs))/g,
        ))
          if (
            !existsSync(join(SKILLS_DIR, m[1] ?? name, m[2])) &&
            // `scripts/start.mjs` без префікса скіла — файл самого магазину.
            !(
              !m[1] &&
              m[2].startsWith('scripts/') &&
              existsSync(join(TEMPLATE_DIR, m[2]))
            )
          )
            dead.push(`${file}: ${m[0]}`);
        // `scripts/dev-stand/…` та інше з scripts/ монорепо в магазині не існує.
        for (const m of text.matchAll(/scripts\/dev-stand\/[\w./-]+/g))
          dead.push(`${file}: ${m[0]} (лише монорепо)`);
      }
      expect(dead).toEqual([]);
    },
  );

  it('кожна згадка simplycms-<name> у скілах і intro.md — існуюча тека скіла', () => {
    const intro = readFileSync(INTRO, 'utf8');
    const sources = [...allTexts, { file: 'intro.md', text: intro }];
    const dead: string[] = [];
    for (const { file, text } of sources) {
      for (const m of text.matchAll(/(?<![\w@/-])(simplycms-[a-z]+)(?![\w-])/g))
        if (!skillNames.includes(m[1]) && !NOT_SKILLS.includes(m[1]))
          dead.push(`${file}: ${m[1]}`);
    }
    expect(dead).toEqual([]);
  });

  it('таблиця «намір → скіл» в intro.md перелічує рівно теки simplycms-*', () => {
    const intro = readFileSync(INTRO, 'utf8');
    const rows = intro
      .split('\n')
      .filter((l) => /^\|.*\|\s*`simplycms-[a-z]+`\s*\|$/.test(l));
    const listed = rows.map((l) => /`(simplycms-[a-z]+)`\s*\|$/.exec(l)![1]);
    expect([...listed].sort()).toEqual(skillNames);
  });
});

describe('скіли магазину: залежності від пакета', () => {
  it('simplycms-update читає CHANGELOG з node_modules: файл у files і кладеться prepack-ом і прибирається postpack-ом', () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'packages/simplycms/package.json'), 'utf8'),
    ) as { files: string[]; scripts: Record<string, string> };
    expect(pkg.files).toContain('CHANGELOG.md');
    expect(pkg.scripts.prepack).toContain('CHANGELOG.md');
    // Без postpack копія лишається в дереві й тест реєстру обходів бачить у ній маркери.
    expect(pkg.scripts.postpack).toContain('CHANGELOG.md');
    const update = texts('simplycms-update')
      .map((t) => t.text)
      .join('\n');
    expect(update).toContain('CHANGELOG.md');
  });
});

describe('скіли магазину: тексти помилок збігаються з кодом', () => {
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const pitfalls = flat(
    readFileSync(
      join(SKILLS_DIR, 'simplycms-diagnose/references/pitfalls.md'),
      'utf8',
    ),
  );

  it.each([
    ['UnjournaledDatabaseError', new UnjournaledDatabaseError().message],
    [
      'MigrationChecksumError',
      new MigrationChecksumError(['x']).message.replace('x', '<файли>'),
    ],
  ])('pitfalls.md цитує %s повним текстом з коду', (_name, message) => {
    expect(pitfalls).toContain(flat(message));
  });

  it('повідомлення ядра радять лише команди, що є в магазині', () => {
    const message = new UnjournaledDatabaseError().message;
    const bad = [...message.matchAll(/\bpnpm\s+([a-z][\w:-]*)/g)]
      .map((m) => m[1])
      .filter((w) => !PNPM_BUILTIN.includes(w) && !templateScripts.includes(w));
    expect(bad).toEqual([]);
  });

  it('лог старту друкує лише текст помилки: скіли не шукають імені класу', () => {
    const logs = readFileSync(
      join(SKILLS_DIR, 'simplycms-diagnose/references/logs.md'),
      'utf8',
    );
    expect(logs).not.toMatch(/MigrationChecksumError/);
    expect(pitfalls).not.toMatch(/імʼя помилки/);
  });
});

describe('скіли магазину: заборонені вирази', () => {
  it('жодних @latest для пакетів SimplyCMS (у RC-період вхід — @next)', () => {
    const bad = allTexts.filter(({ text }) =>
      /simplycms[\w-]*@latest/.test(text),
    );
    expect(bad.map((b) => b.file)).toEqual([]);
  });

  it('жодних згадок видаленої підкоманди secrets-file pipe', () => {
    const bad = allTexts.filter(({ text }) =>
      /secrets-file(?:\.mjs)?\s+pipe/.test(text),
    );
    expect(bad.map((b) => b.file)).toEqual([]);
  });
});
