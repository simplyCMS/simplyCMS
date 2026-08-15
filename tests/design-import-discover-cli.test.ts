/**
 * Смок `discover.mjs` у headless chromium (Фаза 3, задача §2.C, план Р4/Р5,
 * Step 2). Детект наявності браузера — та сама top-level await схема, що в
 * `design-import-inspect.test.ts` (SKIP чесно, якщо chromium недоступний).
 * Фікстурний «сайт» — `tests/fixtures/design-import/site/`, роздається
 * локальним http-сервером (прецедент — 403-тест `design-import-inspect`):
 * `page.setContent` тут не годиться, бо потрібні РЕАЛЬНІ HTTP-статуси для
 * `visited`/`visit-failed`.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveChromium } from '../.agents/skills/redesign-from-reference/scripts/lib/browser.mjs';

const execFileAsync = promisify(execFile);
const SITE_DIR = join(process.cwd(), 'tests/fixtures/design-import/site');
const DISCOVER_CLI = join(
  process.cwd(),
  '.claude/skills/redesign-from-reference/scripts/discover.mjs',
);

/** Сторінки фікстурного «сайту» за pathname — `/about` НАВМИСНО відсутній (404, кейс visit-failed). */
function loadPages() {
  return {
    '/': readFileSync(join(SITE_DIR, 'index.html'), 'utf8'),
    '/collection': readFileSync(join(SITE_DIR, 'collection.html'), 'utf8'),
    '/product/toy-drone': readFileSync(join(SITE_DIR, 'product.html'), 'utf8'),
    '/cart': readFileSync(join(SITE_DIR, 'cart.html'), 'utf8'),
  };
}

/** Локальний http-сервер фікстурного «сайту» — випадковий вільний порт. */
async function startSiteServer() {
  const pages = loadPages();
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const body = pages[pathname as keyof typeof pages];
    if (body) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(body);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>Not found</h1>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  return { server, baseUrl: `http://127.0.0.1:${port}/` };
}

let browser: import('@playwright/test').Browser | null = null;
let skipReason = '';
try {
  const launchOptions = resolveChromium(chromium);
  browser = await chromium.launch({ headless: true, ...launchOptions });
} catch (error) {
  skipReason = error instanceof Error ? error.message : String(error);
}

afterAll(async () => {
  await browser?.close();
});

describe.skipIf(!browser)(
  browser
    ? 'discover.mjs — смок у headless chromium'
    : `discover.mjs — SKIP: ${skipReason}`,
  () => {
    it('home+listing+product+cart знайдені; checkout — no-candidate; about — visit-failed', async () => {
      const { server, baseUrl } = await startSiteServer();
      const outDir = mkdtempSync(join(tmpdir(), 'design-import-discover-'));
      const out = join(outDir, 'sitemap-proposal.json');
      try {
        const run = await execFileAsync(
          process.execPath,
          [DISCOVER_CLI, baseUrl, '--out', out],
          {
            encoding: 'utf8',
          },
        );
        expect(run.stdout).toContain('✅');

        expect(existsSync(out)).toBe(true);
        const proposal = JSON.parse(readFileSync(out, 'utf8'));

        expect(proposal.schemaVersion).toBe(1);
        expect(proposal.linksSeen).toBeGreaterThan(0);

        expect(proposal.pageTypes.home).toMatchObject({
          url: baseUrl,
          visited: true,
        });
        expect(proposal.pageTypes.listing).toMatchObject({
          url: `${baseUrl}collection`,
          visited: true,
        });
        expect(proposal.pageTypes.product).toMatchObject({
          url: `${baseUrl}product/toy-drone`,
          visited: true,
        });
        // Кошик — іконковий лінк без видимого тексту: тип розпізнано з aria-label (Р3b).
        expect(proposal.pageTypes.cart).toMatchObject({
          url: `${baseUrl}cart`,
          visited: true,
        });

        expect(proposal.unresolved).toContainEqual({
          type: 'checkout',
          reason: 'no-candidate',
        });
        // `/about` є кандидатом (URL-патерн + якір «About Us»), але 404 на
        // сервері — перепідбору немає (інших кандидатів на `about` нема) →
        // тип іде в unresolved із чесною причиною `visit-failed`, НЕ лишається
        // «знайденим» (Р4).
        expect(proposal.unresolved).toContainEqual({
          type: 'about',
          reason: 'visit-failed',
        });
      } finally {
        rmSync(outDir, { recursive: true, force: true });
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    }, 60_000);
  },
);
