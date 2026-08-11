import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { ownerCredentials } from './env';
import { t } from './i18n';

/**
 * Логін власника через СПРАВЖНЮ форму `/auth` — той самий шлях, що й
 * реальний користувач, а не прямий виклик Supabase з тесту: якщо форма
 * зламана, тест має це показати, а не непомітно обійти.
 */
export async function loginAsOwner(page: Page): Promise<void> {
  const { email, password } = ownerCredentials();

  await page.goto('/auth');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page
    .getByRole('button', { name: t('auth.login.submit'), exact: true })
    .click();

  // Успішний логін веде на '/' (Auth.tsx: navigate({ to: '/' }) в useEffect
  // після появи сесії) — сам факт переходу і є доказом робочого логіну.
  await expect(page).toHaveURL('/');
}
