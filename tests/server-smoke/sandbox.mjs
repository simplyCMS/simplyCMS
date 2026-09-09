/**
 * Пісочниця для смоку `server.mjs` — те, чим магазин реально стартує.
 *
 * 🔴 Чому не запускаємо runner прямо з кореня репо. По-перше, `.env`/`.env.local`
 * він читає з ТЕКИ ЗАПУСКУ — тест підхопив би реальні ключі розробника.
 * По-друге, `dist/server/server.js` тягне за собою Supabase, тобто БД і
 * мережу, а гейт має лишатися детерміністичним. Тому пісочниця везе
 * СПРАВЖНІЙ `server.mjs` (копія з кореня, байт-у-байт) поверх ЗАГЛУШКИ
 * fetch-handler-а: перевіряємо саме Node-шар — наповнення env, гілку sirv,
 * конвертацію запиту й 500-хендлер, а не рендер сторінки.
 *
 * Тека — під `node_modules/.cache/`: звідти резолвиться `sirv` (Node підіймається
 * до кореневого `node_modules`), а сама вона gitignored.
 */
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Заглушка `dist/server/server.js`: той самий контракт `{ fetch(Request) }`. */
const STUB_HANDLER = `export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    // Гілка 500-хендлера: помилка ПІСЛЯ того, як sirv віддав запит далі.
    if (pathname === '/__boom') throw new Error('смок: навмисна помилка');
    // Дзеркало env процесу — джерело правди для перевірки наповнення.
    if (pathname === '/__env') {
      return Response.json({
        SMOKE_FROM_PROCESS: process.env.SMOKE_FROM_PROCESS ?? null,
        SMOKE_SHARED: process.env.SMOKE_SHARED ?? null,
        SMOKE_ONLY_LOCAL: process.env.SMOKE_ONLY_LOCAL ?? null,
        SMOKE_ONLY_ENV: process.env.SMOKE_ONLY_ENV ?? null,
      });
    }
    return new Response('<!doctype html><html><body>смок</body></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  },
};
`;

/** Вільний порт: піднімаємо й одразу віддаємо (гонка тут неістотна). */
const freePort = () =>
  new Promise((done) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

/** Розкладає пісочницю на диску й повертає її шлях. */
function layout() {
  const dir = join(
    ROOT,
    'node_modules',
    '.cache',
    `server-smoke-${process.pid}-${Date.now()}`,
  );
  mkdirSync(join(dir, 'dist', 'server'), { recursive: true });
  mkdirSync(join(dir, 'dist', 'client', 'assets'), { recursive: true });

  // Обидва файли runner-а — реальні, з кореня репо.
  for (const file of ['server.mjs', 'server-runtime.mjs']) {
    copyFileSync(join(ROOT, file), join(dir, file));
  }
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(join(dir, 'dist', 'server', 'server.js'), STUB_HANDLER);
  writeFileSync(
    join(dir, 'dist', 'client', 'assets', 'app-smoke123.js'),
    'export const smoke = true;\n',
  );
  writeFileSync(join(dir, 'dist', 'client', 'favicon.ico'), 'ico\n');

  // Пріоритет контракту: process.env > .env.local > .env.
  writeFileSync(
    join(dir, '.env.local'),
    'SMOKE_FROM_PROCESS=from-env-local\nSMOKE_SHARED=from-env-local\nSMOKE_ONLY_LOCAL=from-env-local\n',
  );
  writeFileSync(
    join(dir, '.env'),
    'SMOKE_FROM_PROCESS=from-env\nSMOKE_SHARED=from-env\nSMOKE_ONLY_ENV=from-env\n',
  );
  return dir;
}

/** Піднімає `node server.mjs` у пісочниці; віддає базовий URL і стоп-функцію. */
export async function startSmokeServer() {
  const dir = layout();
  const port = await freePort();
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: dir,
    // 🔴 Env НЕ успадковуємо: реальні ключі розробника зробили б перевірку
    // пріоритету недетерміністичною.
    env: {
      PATH: process.env.PATH ?? '',
      PORT: String(port),
      HOST: '127.0.0.1',
      SMOKE_FROM_PROCESS: 'from-process',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let log = '';
  child.stdout.on('data', (chunk) => (log += chunk));
  child.stderr.on('data', (chunk) => (log += chunk));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`server.mjs упав (код ${child.exitCode}):\n${log}`);
    }
    try {
      await fetch(`${baseUrl}/__env`);
      break;
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`server.mjs не піднявся за 15 с:\n${log}`);
      }
      await new Promise((done) => setTimeout(done, 50));
    }
  }

  return {
    baseUrl,
    log: () => log,
    stop: () => {
      child.kill('SIGKILL');
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
