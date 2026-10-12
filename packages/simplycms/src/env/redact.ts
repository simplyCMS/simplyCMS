/**
 * Маскує userinfo в усіх `scheme://userinfo@host` усередині тексту:
 * `scheme://***@host`. Маскується весь userinfo, а не лише пароль: імʼя
 * користувача — теж ідентифікатор (ключ доступу S3, логін SMTP).
 *
 * Живе в `env` (а не в `storage` чи `mail`): обидва порти мають право на цей
 * тір (upward `env`), а помилки драйверів сховища й пошти однаково тягнуть
 * у повідомлення рядок підключення з `S3_*`/`SMTP_URL`.
 */
export function redactUrls(text: string): string {
  return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/]*@/gi, '$1***@');
}
