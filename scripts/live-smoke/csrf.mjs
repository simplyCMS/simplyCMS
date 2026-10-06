/**
 * CSRF-захист (тема 2 спеки deps-security-tooling) — живий доказ на справжньому
 * збереженому сервері, а не на юніті міддлвари.
 *
 * Що доводить: Start вмикає дефолтний CSRF-захист лише БЕЗ `startInstance`, а
 * в магазині він є — тож захист має бути явним (`simplycms/runtime/csrf` у
 * `src/start.ts`). Тут POST із чужим `Origin` (без браузера, як це зробив би
 * `curl`) на справжню server function і на server route `/api/health` мусить
 * дістати 403 ВІД МІДДЛВАРИ, тобто текст `Forbidden`.
 *
 * 🔴 Межа доказу для server route (Е6б-18, ред.3): перевірка доводить, що
 * міддлвара CSRF стоїть перед УСІМА шляхами поза serverFn, а не що виконується
 * хендлер server route. Інших не-serverFn POST-роутів поза `/api/auth/`
 * (виняток CSRF) у ядрі немає, а тестовий POST-роут у продакшн-дерево заради
 * гейта не додаємо.
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

  // 2. Server route поза server functions: `/api/health` (лише GET).
  const route = await post('/api/health', evil);
  const routeBody = await route.text();
  check(
    'csrf: міддлвара перед server route, чужий Origin → 403',
    route.status === 403 && routeBody === 'Forbidden',
    `${route.status} ${JSON.stringify(routeBody.slice(0, 40))}`,
  );

  // Контроль: свій Origin міддлвару ПРОХОДИТЬ — доводить, що відмова вище
  // саме CSRF, а не загальна заборона шляху. Статус — точний, виміряний
  // кроком «зелений одразу» Task 7 (Е6б-18): 200, а не очікувані планом 405.
  // У `/api/health` немає POST-хендлера, і Start не відповідає 405 — запит
  // проходить далі в рендер роутера (SSR-сторінка, `text/html`). Тому
  // статус залежить від здоровʼя рендера: на зламаній БД стенда той самий
  // запит дав 500. Асерт — точне число, а не «будь-що, крім Forbidden».
  const same = await post('/api/health', { origin: base });
  const sameBody = await same.text();
  check(
    'csrf: міддлвара перед server route, свій Origin → пропускає (200)',
    same.status === 200 && sameBody !== 'Forbidden',
    `${same.status} ${JSON.stringify(sameBody.slice(0, 40))}`,
  );
}
