// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { AvatarUpload } from '../AvatarUpload';

// 🔴 Контур К4 (порт сховища файлів) ще не приземлився — компонент має
// чесно відмовляти замість тихо ходити в неіснуючий Supabase. Тест ловить
// регрес, якщо хтось поверне мовчазний `onUpload`.
it('аватар недоступний до контуру К4 — інпут вимкнено, причина видима', () => {
  render(
    <I18nProvider locale="uk">
      <AvatarUpload
        userId="00000000-0000-0000-0000-000000000001"
        currentAvatarUrl={null}
        firstName="Тест"
        lastName="Тестенко"
        email="test@example.com"
        onUpdate={() => {}}
      />
    </I18nProvider>,
  );

  // `getByText`/`getByTestId` самі кидають, якщо елемент відсутній —
  // окремих матчерів jest-dom (не підключені в цьому проєкті) не треба.
  screen.getByText(/тимчасово недоступне/i);
  const input = screen.getByTestId('avatar-file-input') as HTMLInputElement;
  expect(input.disabled).toBe(true);
});
