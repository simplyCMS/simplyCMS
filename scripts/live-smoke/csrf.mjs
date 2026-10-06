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
 * 🔴 Межа доказу для server route (Е6б-18, ред.3; Е6б-28): перевірка доводить,
 * що міддлвара CSRF стоїть перед УСІМА шляхами поза serverFn, а свій Origin
 * доходить до роуту (його `ANY` відмовляє 405). Що виконується POST-хендлер,
 * що змінює стан, вона не доводить: інших не-serverFn POST-роутів поза
 * `/api/auth/` (виняток CSRF) у ядрі немає, а тестовий POST-роут у
 * продакшн-дерево заради гейта не додаємо.
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

  // Контроль: свій Origin міддлвару ПРОХОДИТЬ і доходить до роуту — доводить,
  // що відмова вище саме CSRF, а не загальна заборона шляху. Роут відповідає
  // на не-GET рівно 405 з `Allow: GET` (`ANY` у `health.tsx`, Е6б-28): статус
  // не залежить від БД і SSR. Асерт — точне число, а не «будь-що, крім
  // Forbidden».
  const routeSame = await post('/api/health', { origin: base });
  const allow = routeSame.headers.get('allow');
  check(
    'csrf: міддлвара перед server route, свій Origin → 405 Allow: GET',
    routeSame.status === 405 && allow === 'GET',
    `${routeSame.status} allow=${allow ?? '—'}`,
  );
}
