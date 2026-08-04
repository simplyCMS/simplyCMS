// Ядро owner:invite — чиста логіка з інʼєкцією service_role-клієнта,
// щоб тестувалась без мережі. Модель загроз — спека 2026-08-03 §4.2.
// Лист будує GoTrue за шаблоном supabase/templates/invite.html (token_hash
// → /auth/confirm), тому redirectTo у виклику invite не потрібен.

async function findUserIdByEmail(admin, email) {
  let page = 1;
  while (page != null) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers: ${error.message ?? error.code}`);
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit.id;
    page = data.nextPage ?? null;
  }
  throw new Error(
    `Користувача ${email} не знайдено попри email_exists — перевір проєкт.`,
  );
}

export async function runOwnerInvite({
  admin,
  email,
  siteUrl,
  resend = false,
  log,
}) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  let userId;
  let invited = false;
  let resendLink;
  if (error) {
    // ЛИШЕ email_exists — легальний стан «уже є»; будь-який інший код
    // (validation_failed, rate limit, …) — справжня помилка, не ковтати.
    if (error.code !== 'email_exists') {
      throw new Error(`inviteUserByEmail: ${error.message ?? error.code}`);
    }
    log(`Користувач ${email} уже існує — invite не потрібен, перевіряю роль.`);
    userId = await findUserIdByEmail(admin, email);
    if (resend) {
      // Для існуючого користувача invite повторно не шлеться — даємо
      // одноразовий magiclink на той самий /auth/confirm-роут.
      const link = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      if (link.error)
        throw new Error(
          `generateLink: ${link.error.message ?? link.error.code}`,
        );
      resendLink = `${siteUrl.replace(/\/$/, '')}/auth/confirm?token_hash=${link.data.properties.hashed_token}&type=magiclink&next=/auth/set-password`;
      log(
        `Одноразове посилання (передай власнику захищеним каналом, TTL ~1 год):\n  ${resendLink}`,
      );
    }
  } else {
    userId = data.user.id;
    invited = true;
    log(`Запрошення надіслано на ${email}.`);
  }
  const roleResult = await admin
    .from('user_roles')
    .upsert(
      { user_id: userId, role: 'admin' },
      { onConflict: 'user_id,role', ignoreDuplicates: true },
    );
  if (roleResult.error)
    throw new Error(`user_roles upsert: ${roleResult.error.message}`);
  log(`Роль admin закріплена за ${email}.`);
  return { userId, invited, roleAdded: true, resendLink };
}
