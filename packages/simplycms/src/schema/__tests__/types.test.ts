import { describe, expectTypeOf, it } from 'vitest';

import type {
  NewOrder,
  NewProfile,
  NewUser,
  Order,
  Profile,
  User,
} from '../types';

// Компіляційні тести типів, виведених із Drizzle-схеми (B12, частина).
//
// 🔴 Навіщо вони, якщо `tsc` і так зелений. `tsc` перевіряє лише те, що ХТОСЬ
// уже вживає; самі по собі експортовані типи він не «використовує», тож
// випадкове звуження (колонка зникла зі схеми, `notNull` став nullable,
// тип PK змінився з uuid на text) проходить зеленим доти, доки до нього не
// дійде перший споживач — а це вже К2/К3. Ці асерти роблять регресію
// видимою в тому самому комміті, що її вносить.
//
// Перевіряються три таблиці з різними властивостями: `users` (Better Auth,
// uuid-PK — саме те, що не можна зламати за B3′), `orders` (доменна,
// user-scoped, під RLS) і `profiles` (1:1 із користувачем).

describe('типи з Drizzle-схеми', () => {
  it('users: uuid-PK і обовʼязковий email (контракт B3′)', () => {
    expectTypeOf<User['id']>().toEqualTypeOf<string>();
    expectTypeOf<User['email']>().toEqualTypeOf<string>();
    // `emailVerified` — прапорець BA, не nullable у канонічній схемі.
    expectTypeOf<User['emailVerified']>().toEqualTypeOf<boolean>();
  });

  it('users: у Insert-моделі id необовʼязковий (є DB-default)', () => {
    expectTypeOf<NewUser>().toHaveProperty('id');
    expectTypeOf<NewUser['id']>().toEqualTypeOf<string | undefined>();
  });

  it('orders: FK на користувача nullable — гостьове замовлення легальне', () => {
    // 🔴 Не «недогляд схеми»: гість оформлює замовлення без акаунта, доступ
    // до нього дає `orders.access_token` (GUC `app.order_token`), а не user_id.
    expectTypeOf<Order['userId']>().toEqualTypeOf<string | null>();
    expectTypeOf<Order['orderNumber']>().toEqualTypeOf<string>();
  });

  it('orders: Insert вимагає бізнес-обовʼязкові поля', () => {
    expectTypeOf<NewOrder>().toHaveProperty('orderNumber');
    expectTypeOf<NewOrder>().toHaveProperty('email');
    expectTypeOf<NewOrder>().toHaveProperty('total');
  });

  it('profiles: звʼязок із користувачем присутній в обох моделях', () => {
    expectTypeOf<Profile>().toHaveProperty('userId');
    expectTypeOf<NewProfile>().toHaveProperty('userId');
  });
});
