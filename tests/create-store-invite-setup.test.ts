import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Інструкція власнику про перший вхід — те, що людина читає ОДИН раз і
// виконує буквально. Тому вона під тестом: розсинхрон тут не падає збіркою,
// він просто заводить власника в глухий кут.
//
// 🔴 Перевірялось інше до контракту v2: що Site URL проєкту автентифікації збігається
// з адресою магазину, бо лінк запрошення будував GoTrue з `{{ .SiteURL }}`.
// GoTrue немає — посилання будує САМ скрипт із `VITE_SITE_URL`, і жодних
// auth-налаштувань у Dashboard флоу більше не потребує. Асертимо натомість
// те, що стало правдою: ключ підключення замість service_role, посилання з
// консолі й сторінка, на яку воно веде.
const TEMPLATE = 'packages/create-simplycms-store/template';
const read = (p: string) => readFileSync(p, 'utf8');

describe('create-store: інструкція «призначити власника»', () => {
  const readme = read(`${TEMPLATE}/README.md`);

  it('README веде на /auth/invite і не вимагає service_role-ключа', () => {
    expect(readme).toMatch(/pnpm owner:invite/);
    expect(readme).toMatch(/\/auth\/invite/);
    expect(readme).toMatch(/DATABASE_URL/);
    // 🔴 Найдорожча помилка тут — лишити стару команду: вона просить ключ,
    // якого магазин уже не використовує, і власник шукатиме його в Dashboard.
    expect(readme).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    // Три гілки доставки (Е8-С2): якщо README змовчить про пошту й
    // `--print-link`, власник чекатиме лист, якого не буде, або не знайде посилання.
    expect(readme).toMatch(/SMTP_URL/);
    expect(readme).toMatch(/--print-link/);
  });

  it('README не обіцяє неіснуючих сторінок GoTrue', () => {
    expect(readme).not.toMatch(/\/auth\/confirm/);
    expect(readme).not.toMatch(/invite\.html/);
  });

  // 🔴 README лишається в магазині назавжди — для власника без агента саме він
  // є інструкцією (консоль друкує одне речення, див. create-store-next-steps).
  it('README шаблону не радить накат канону роллю рантайму', () => {
    expect(readme).toContain('pnpm simplycms db:apply');
    expect(readme).not.toContain('psql');
    expect(readme).not.toContain('for f in');
    expect(readme).toContain('MIGRATION_DATABASE_URL');
    expect(readme).toContain('суперкористувача');
  });

  // 🔴 Р18г: фолбеку на localhost немає. Раніше дефолт мусив збігатися з портом
  // dev-сервера; тепер без `VITE_SITE_URL` команда відмовляє (поведінку доводить
  // `simplycms/src/auth/owner-invite-cli/__tests__/owner-invite.test.ts`), а тут стережемо, що літерал не повернувся.
  // Логіка — у ядрі (`simplycms/auth/owner-invite-cli`), у шаблоні — шим.
  it('owner-invite не має дефолтної адреси сайту', () => {
    const CORE = 'packages/simplycms/src/auth/owner-invite-cli';
    for (const file of [
      `${TEMPLATE}/scripts/owner-invite.mjs`,
      ...['run.ts', 'cli.ts', 'main.ts', 'env-files.ts'].map(
        (name) => `${CORE}/${name}`,
      ),
    ])
      expect(read(file)).not.toMatch(/localhost/);
  });
});
