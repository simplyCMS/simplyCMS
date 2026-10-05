/**
 * CSRF-захист (тема 2 спеки deps-security-tooling) — живий доказ на справжньому
 * збереженому сервері, а не на юніті міддлвари.
 *
 * Що доводить: Start вмикає дефолтний CSRF-захист лише БЕЗ `startInstance`, а
 * в магазині він є — тож захист має бути явним (`simplycms/runtime/csrf` у
 * `src/start.ts`). Тут POST із чужим `Origin` (без браузера, як це зробив би
 * `curl`) на справжню server function і на `/api/revalidate-theme` мусить
 * дістати 403 ВІД МІДДЛВАРИ, тобто текст `Forbidden` (хендлер revalidate-theme
 * відповідає JSON `{"error":"forbidden"}` — по тілу відрізняємо відмову
 * міддлвари від відмови хендлера).
 *
 * Шлях server function береться з трафіку воронки (`/_serverFn/<id>` із POST):
 * ідентифікатори хешовані збіркою, вгадувати їх не можна.
 */

/**
 * @param {object} p
 * @param {string} p.base `http://127.0.0.1:<port>`
 * @param {Iterable<string>} p.serverFnPaths pathname-и POST-запитів `/_serverFn/…`
 * @param {(label: string, passed: boolean, fact: string) => void} p.check
 */
export async function runCsrfChecks({ base, serverFnPaths, check }) {
  const evil = { origin: 'https://evil.example' };

  const post = (path, headers) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: '{}',
    });

  // 1. Справжня server function: чужий Origin → 403 `Forbidden` від міддлвари.
  const fnPath = [...serverFnPaths][0];
  check(
    'csrf: у трафіку воронки є POST на server function',
    Boolean(fnPath),
    fnPath ?? '—',
  );
  if (fnPath) {
    const res = await post(fnPath, evil);
    const body = await res.text();
    check(
      'csrf: server function, чужий Origin → 403',
      res.status === 403 && body === 'Forbidden',
      `${res.status} ${JSON.stringify(body.slice(0, 40))}`,
    );

    const cross = await post(fnPath, { 'sec-fetch-site': 'cross-site' });
    check(
      'csrf: server function, Sec-Fetch-Site: cross-site → 403',
      cross.status === 403,
      String(cross.status),
    );

    const bare = await post(fnPath, {});
    check(
      'csrf: server function, жодного заголовка → 403',
      bare.status === 403,
      String(bare.status),
    );

    // Контроль: свій Origin міддлвару ПРОХОДИТЬ (далі — вже відповідь самої
    // server function на порожнє тіло, але не `Forbidden` міддлвари).
    const same = await post(fnPath, { origin: base });
    const sameBody = await same.text();
    check(
      'csrf: server function, свій Origin — міддлвара пропускає',
      !(same.status === 403 && sameBody === 'Forbidden'),
      `${same.status}`,
    );
  }

  // 2. Server route поза server functions.
  const route = await post('/api/revalidate-theme', evil);
  const routeBody = await route.text();
  check(
    '/api/revalidate-theme, чужий Origin → 403 від міддлвари',
    route.status === 403 && routeBody === 'Forbidden',
    `${route.status} ${JSON.stringify(routeBody.slice(0, 40))}`,
  );

  // Контроль: свій Origin доходить до хендлера (той без admin-сесії — свій
  // 403 із JSON, а не `Forbidden` міддлвари): доводить, що відмова вище —
  // саме CSRF, а не загальна заборона маршруту.
  const handler = await post('/api/revalidate-theme', { origin: base });
  const handlerBody = await handler.text();
  check(
    '/api/revalidate-theme, свій Origin → відповідає хендлер',
    handler.status === 403 && handlerBody.includes('"forbidden"'),
    `${handler.status} ${JSON.stringify(handlerBody.slice(0, 40))}`,
  );
}
