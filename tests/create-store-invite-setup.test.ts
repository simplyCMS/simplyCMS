import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { printNextSteps } from '../packages/create-simplycms-store/src/steps.mjs';

// Інструкція власнику про перший вхід — те, що людина читає ОДИН раз і
// виконує буквально. Тому вона під тестом: розсинхрон тут не падає збіркою,
// він просто заводить власника в глухий кут.
//
// 🔴 Перевірялось інше до контракту v2: що Site URL проєкту Supabase збігається
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
    // Доставки листа немає — якщо README про це змовчить, власник чекатиме
    // пошту, якої не буде.
    expect(readme).toMatch(/консоль/);
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
    expect(out).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(out).toContain('DATABASE_URL');
    expect(out).toContain('BETTER_AUTH_SECRET');
    expect(out).toContain('/auth/invite');
  });

  // Посилання запрошення будується з `VITE_SITE_URL`, а без нього — з дефолту
  // скрипта. Дефолт мусить збігатися з портом, на якому магазин реально
  // піднімається, інакше лінк веде на порожній порт.
  it('дефолт site URL у owner-invite = порт dev-сервера й `pnpm start`', () => {
    const invite = read(`${TEMPLATE}/scripts/owner-invite.mjs`);
    const port = /'http:\/\/localhost:(\d+)'/.exec(invite)?.[1];

    expect(port).toBe('3000');
    for (const config of [
      `${TEMPLATE}/vite.config.ts`,
      'tests/pilot/store-template/vite.config.ts',
    ]) {
      expect(read(config)).toMatch(
        new RegExp(`server: \\{ port: ${port}, strictPort: true \\}`),
      );
    }
  });
});
