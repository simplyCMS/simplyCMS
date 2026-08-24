import { describe, it, expect } from 'vitest';
import { isAdminPath } from '../src/start';

/**
 * Межа «що саме охороняє серверний guard» (`src/start.ts`).
 *
 * 🔴 Тест не про роль, а про ШЛЯХ. Роль перевіряє інтеграційний гейт
 * (`test-harness/pg/__tests__/admin-guard.test.ts`) проти живої БД; тут
 * доводиться, що guard не пропускає підшляхи адмінки й не чіпає чужі
 * URL, які лише починаються на ті самі літери.
 */
describe('isAdminPath', () => {
  it('охоплює корінь адмінки та її підшляхи', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/')).toBe(true);
    expect(isAdminPath('/admin/orders/42')).toBe(true);
  });

  it('не чіпає вітрину', () => {
    expect(isAdminPath('/')).toBe(false);
    expect(isAdminPath('/catalog')).toBe(false);
    expect(isAdminPath('/profile')).toBe(false);
  });

  it('не ловить шляхи, що лише починаються на ті самі літери', () => {
    // Без цього `/administration` чи товар `/administrator-guide` мовчки
    // потрапляли б під редірект на /auth.
    expect(isAdminPath('/administration')).toBe(false);
    expect(isAdminPath('/admin-panel')).toBe(false);
  });
});
