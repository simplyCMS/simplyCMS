// Фолбек-кластер для `resolveHarness` (up.mjs), коли `PG_HARNESS_URL` не
// заданий: `initdb --no-sync` + `pg_ctl start` у tmp-теці, TCP на вільному
// порту + unix-сокет поруч (для `pg_ctl -w`).
//
// `initdb`/`pg_ctl` відмовляються запускатись від root ("cannot be run as
// root") — у агентному контейнері процес завжди root, а непривілейований
// юзер `postgres` існує завжди, тож фолбек іде через `su postgres -c "…"`.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const PG_BIN_CANDIDATES = [
  '/usr/lib/postgresql/17/bin',
  '/usr/lib/postgresql/16/bin',
  '/usr/local/pgsql/bin',
];

function findPgBin(name) {
  const which = spawnSync('which', [name]);
  if (which.status === 0) return which.stdout.toString().trim();
  for (const dir of PG_BIN_CANDIDATES) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePort(port));
    });
  });
}

// Одинарні лапки екрановані — команда для `su -c` збирається як один рядок.
function shQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

// Єдина точка виклику initdb/pg_ctl: під root — через su postgres (shell-
// рядок), інакше — напряму (непривілейований юзер вже власник своєї tmp-теки).
function runPgBin(isRoot, args) {
  if (!isRoot) return spawnSync(args[0], args.slice(1), { encoding: 'utf8' });
  const command = args.map(shQuote).join(' ');
  return spawnSync('su', ['postgres', '-c', command], { encoding: 'utf8' });
}

export async function startEphemeralCluster() {
  const initdb = findPgBin('initdb');
  const pgCtl = findPgBin('pg_ctl');
  if (!initdb || !pgCtl) {
    throw new Error(
      'initdb/pg_ctl не знайдено (ні в PATH, ні у стандартних теках ' +
        'PostgreSQL). Задай PG_HARNESS_URL на готовий кластер або встанови ' +
        'postgresql-client/-server локально.',
    );
  }

  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const base = mkdtempSync(join(tmpdir(), 'simplycms-pg-'));
  const dataDir = join(base, 'data');
  const sockDir = join(base, 'sock');
  mkdirSync(sockDir, { recursive: true });
  const port = await findFreePort();

  if (isRoot) {
    // root може chown-ити довільний файл — робимо теку писабельною для
    // postgres ДО initdb, бо сам initdb під root не запускається.
    execFileSync('chown', ['-R', 'postgres:postgres', base]);
  }

  const init = runPgBin(isRoot, [
    initdb,
    '--no-sync',
    '-U',
    'postgres',
    '-A',
    'trust',
    '-D',
    dataDir,
  ]);
  if (init.status !== 0) {
    const hint = isRoot
      ? 'якщо непривілейованого юзера postgres немає — задай PG_HARNESS_URL.'
      : 'запусти під непривілейованим юзером або задай PG_HARNESS_URL.';
    throw new Error(
      `initdb не вдався (${isRoot ? 'su postgres' : 'напряму'}):\n` +
        `${init.stderr || init.error?.message}\nПідказка: ${hint}`,
    );
  }

  // TCP на 127.0.0.1 (для звичайних URL) + unix-сокет у tmp-теці (потрібен
  // `pg_ctl -w` для перевірки готовності без пароля).
  appendFileSync(
    join(dataDir, 'postgresql.conf'),
    `\nlisten_addresses = '127.0.0.1'\nport = ${port}\n` +
      `unix_socket_directories = '${sockDir}'\n`,
  );

  const start = runPgBin(isRoot, [
    pgCtl,
    '-D',
    dataDir,
    '-l',
    join(base, 'pg.log'),
    '-w',
    'start',
  ]);
  if (start.status !== 0) {
    throw new Error(
      `pg_ctl start не вдався:\n${start.stderr || start.error?.message}`,
    );
  }

  const url = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  const teardown = async () => {
    runPgBin(isRoot, [pgCtl, '-D', dataDir, '-m', 'fast', '-w', 'stop']);
    spawnSync('rm', ['-rf', base]);
  };

  return { url, teardown };
}
