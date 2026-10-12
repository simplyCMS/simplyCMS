import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dirtyMarkup } from './demo-seed-clean/dirty';

/**
 * Демо-сід — продуктові дані КОЖНОГО магазину (власник бачить їх в адмінці, агент копіює як зразок
 * контенту). Брудної розмітки там бути не може. Проба санітайзера для пілота живе окремим оверлеєм
 * `scripts/pilot-pack/sanitize-probe.sql` (поза пакетом і шаблоном).
 */
const ROOT = join(import.meta.dirname, '..');
const DIRS = [
  'packages/simplycms/migrations/demo',
  'packages/create-simplycms-store/template/db/migrations/demo',
];

describe('демо-сід без брудної розмітки', () => {
  it.each(DIRS)('%s', (dir) => {
    const files = readdirSync(join(ROOT, dir), { recursive: true }).map(String);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files.filter((f) => f.endsWith('.sql'))) {
      expect(
        dirtyMarkup(readFileSync(join(ROOT, dir, file), 'utf8')),
        `${dir}/${file}: брудна розмітка`,
      ).toEqual([]);
    }
  });
});

// Негативні контролі: кожна форма — окремий кейс, інакше чорний список мовчки звузиться.
describe('dirtyMarkup: синтетичні форми', () => {
  it.each([
    ['<script', '<p><script>alert(1)</script></p>', '<script'],
    ['<iframe', '<iframe src="x"></iframe>', '<iframe'],
    ['<object', '<object data="x"></object>', '<object'],
    ['<embed', '<embed src="x">', '<embed'],
    ['onerror=', '<img src=x onerror=alert(1)>', 'on*=-обробник'],
    ['onclick із пробілом', '<a onclick = "x()">', 'on*=-обробник'],
    ['onmouseover', '<div onmouseover="x()">', 'on*=-обробник'],
    ['srcdoc', '<iframe srcdoc="<p>x</p>">', 'srcdoc'],
    ['javascript:', '<a href="javascript:alert(1)">', 'javascript:'],
    [
      'javascript: числова entity',
      '<a href="&#106;avascript:x">',
      'javascript:',
    ],
    ['javascript: hex entity', '<a href="&#x6a;avascript:x">', 'javascript:'],
    ['javascript: entity без ;', '<a href="&#106avascript:x">', 'javascript:'],
    [
      'javascript: колон-entity',
      '<a href="javascript&colon;x">',
      'javascript:',
    ],
    [
      'javascript: Tab усередині',
      '<a href="java&Tab;script:x">',
      'javascript:',
    ],
    ['javascript: реальний таб', '<a href="java\tscript:x">', 'javascript:'],
    ['<script як entity', '&lt;script&gt;x', '<script'],
    ['onerror як entity', '<img &#111;nerror=x>', 'on*=-обробник'],
  ])('%s → брудне', (_name, text, rule) => {
    expect(dirtyMarkup(text)).toContain(rule);
  });

  it.each([
    ['звичайний абзац', '<p>Смачна кава &amp; чай</p>'],
    ['посилання http', '<a href="https://example.com/a?b=1">x</a>'],
    [
      'SQL без обробників',
      "insert into products (id, name) values ('a', 'b');",
    ],
    ['слово on conflict', 'on conflict (id) do nothing;'],
  ])('%s → чисте', (_name, text) => {
    expect(dirtyMarkup(text)).toEqual([]);
  });
});
