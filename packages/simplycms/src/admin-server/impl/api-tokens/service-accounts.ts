import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { defineOperation } from 'simplycms/operations';
import { userRoles, users } from 'simplycms/schema';

// Сервісні облікові записи (М1, І27): власники токенів інтеграцій. `sessionOnly`:
// витеклий Bearer не заводить нових суб'єктів.

/** Домен зарезервований RFC 2606: пошта сервісного запису нікуди не доставляється. */
const SERVICE_EMAIL_DOMAIN = 'service.invalid';

export const serviceAccountsCreate = defineOperation({
  id: 'service-accounts.create',
  permission: 'apiToken.manage',
  sessionOnly: true,
  input: z.object({
    name: z.string().trim().min(1).max(100),
    role: z.enum(['admin', 'user']),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(['admin', 'user']),
  }),
  async run({ db }, input) {
    // Користувач БЕЗ рядка `accounts`: увійти паролем чи OAuth не може за побудовою.
    // 🔴 `users` — Категорія B: `id` кладе БД (гейт explicit-ids), тож вхід без
    // `id`, а ключ береться з `returning`. Пошта унікальна за власним суфіксом.
    const [created] = await db
      .insert(users)
      .values({
        name: input.name,
        email: `service-${randomUUID()}@${SERVICE_EMAIL_DOMAIN}`,
        emailVerified: true,
      })
      .returning({ id: users.id });
    const id = created!.id;
    await db
      .insert(userRoles)
      .values({ id: randomUUID(), userId: id, role: input.role });
    return { id, name: input.name, role: input.role };
  },
});
