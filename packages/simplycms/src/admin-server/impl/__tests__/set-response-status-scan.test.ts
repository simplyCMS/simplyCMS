// С-10в: статус відповіді адмінки ставить МЕЖА — `runAdminTransactions`
// (`run.ts`) для помилок усередині операції і вхід serverFn (`validation.ts`:
// `adminInput`/`parseAdminInput` виконуються ДО межі). Ядро, що саме кличе
// `setResponseStatus`, падає поза HTTP-запитом (сід, порти, MCP-сервер
// магазину): справжня функція кидає «No StartEvent found». Тож будь-яке
// згадування ідентифікатора в коді `admin-server/**` поза allowlist —
// червоне, хоч би як його імпортували (іменовано, з `as`, через `* as`).
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(
  ['../../**/*.{ts,tsx}', '!../../**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Ключ glob (відносно `__tests__`) → шлях від `src/`: `admin-server/impl/…`. */
const rel = (key: string) =>
  new URL(key, 'file:///src/admin-server/impl/__tests__/').pathname.replace(
    '/src/',
    '',
  );

/** Межі, яким статус ставити дозволено (з причиною). */
const ALLOWED: Record<string, string> = {
  'admin-server/impl/run.ts':
    'межа операції: 409/400 для доменних помилок ДО повторного throw',
  'admin-server/impl/validation.ts':
    'вхід serverFn: Zod-відмова → 400 ще ДО runAdminTransactions',
};

/** Блокові й цілорядкові коментарі геть: згадка в доці — не виклик. */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

const offenders = () =>
  Object.entries(sources)
    .filter(([, src]) => /\bsetResponseStatus\b/.test(code(src)))
    .map(([path]) => rel(path));

describe('admin-server: setResponseStatus лише на межі (С-10)', () => {
  it('скан бачить файли admin-server (не порожній)', () => {
    expect(Object.keys(sources).map(rel)).toContain('admin-server/impl/run.ts');
  });

  it('ідентифікатор живе лише у файлах allowlist', () => {
    expect(offenders().filter((p) => !(p in ALLOWED))).toEqual([]);
  });

  it('allowlist не застарів: кожна межа справді ставить статус', () => {
    const present = new Set(offenders());
    for (const p of Object.keys(ALLOWED)) expect(present.has(p), p).toBe(true);
  });
});
