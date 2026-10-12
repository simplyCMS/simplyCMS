import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { printNextSteps } from '../packages/create-simplycms-store/src/steps.mjs';

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

  it('printNextSteps друкує ту саму команду й ті самі ключі', () => {
    let out = '';
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        out += String(chunk);
        return true;
      });
    try {
      printNextSteps({ dirLabel: 'my-shop', installed: true, hasEnv: true });
    } finally {
      spy.mockRestore();
    }

    expect(out).toContain('owner:invite');
    // 🔴 Накат схеми — `simplycms db:apply` (ядро `simplycms/migrate`). Ні
    // стара порада `supabase db push` (відхиляє нумеровані імена канону), ні
    // ручний `psql`-цикл (повз журнал сум) не повертаються.
    expect(out).toContain('db:apply');
    expect(out).not.toContain('supabase/migrations');
    expect(out).not.toContain('psql');
    expect(out).not.toContain('for f in');
    expect(out).not.toContain('supabase db push');
    // 🔴 Накат канону НЕ під `DATABASE_URL` із .env.local: там роль
    // `app_runtime` (`nosuperuser nocreatedb nocreaterole`), а
    // `0000_prelude.sql` створює ролі й безумовно робить `alter role`. Порада
    // `psql "$DATABASE_URL"` падала за будь-якого стану бази, тож накат
    // іде підключенням власника з `MIGRATION_DATABASE_URL` — інакше
    // регресія повернулась би мовчки.
    expect(out).toContain('MIGRATION_DATABASE_URL');
    expect(out).toContain('власник БД');
    expect(out).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(out).toContain('DATABASE_URL');
    expect(out).toContain('BETTER_AUTH_SECRET');
    expect(out).toContain('/auth/invite');
  });

  // 🔴 Вивід термінала прокручується, а README лишається в магазині назавжди —
  // саме він для власника є інструкцією. Гард лише на `printNextSteps` давав би
  // впевненість, якої немає: перший фікс цього дефекту закрив вивід CLI і
  // пропустив README, який `scaffold()` фізично копіює в новий магазин.
  it('README шаблону не радить накат канону роллю рантайму', () => {
    expect(readme).toContain('pnpm simplycms db:apply');
    expect(readme).not.toContain('psql');
    expect(readme).not.toContain('for f in');
    expect(readme).toContain('MIGRATION_DATABASE_URL');
    expect(readme).toContain('власника БД');
  });

  // 🔴 Р18г: фолбеку на localhost немає. Раніше дефолт мусив збігатися з портом
  // dev-сервера; тепер без `VITE_SITE_URL` команда відмовляє (поведінку доводить
  // `tests/owner-invite.test.ts`), а тут стережемо, що літерал не повернувся.
  it('owner-invite не має дефолтної адреси сайту', () => {
    for (const file of [
      'owner-invite.mjs',
      'owner-invite-core.mjs',
      'owner-invite-cli.mjs',
    ])
      expect(read(`${TEMPLATE}/scripts/${file}`)).not.toMatch(/localhost/);
  });
});
