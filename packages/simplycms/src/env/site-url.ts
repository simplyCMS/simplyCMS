type Env = Readonly<Record<string, string | undefined>>;

/**
 * Єдиний будівельник абсолютних посилань у листах (Р18в): origin береться ЛИШЕ з
 * `VITE_SITE_URL`, ніколи з запиту (`Host`, `X-Forwarded-*`, `request.url`) —
 * інакше підроблений заголовок отруїв би посилання скидання пароля чи запрошення.
 *
 * Помилка називає ключ, але не значення: у `VITE_SITE_URL` може лежати що завгодно.
 */
export function siteUrl(path: string, env: Env): string {
  if (!path.startsWith('/'))
    throw new Error('[simplycms/env] siteUrl: шлях має починатися з "/".');
  const raw = env.VITE_SITE_URL;
  if (!raw)
    throw new Error(
      '[simplycms/env] Відсутня змінна оточення VITE_SITE_URL — нема з чого ' +
        'будувати посилання в листах.',
    );
  let origin: string;
  try {
    origin = new URL(raw).origin;
  } catch {
    throw new Error(
      '[simplycms/env] VITE_SITE_URL не є коректною абсолютною адресою.',
    );
  }
  return origin + path;
}
