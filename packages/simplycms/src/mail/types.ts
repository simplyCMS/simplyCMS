/** Лист, який ядро віддає транспорту. */
export type MailMessage = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly replyTo?: string;
  /**
   * Тип листа (`invite`, `password-reset`, …): єдине, що `log` у проді друкує
   * замість тіла. Тіло листа скидання пароля — секрет (посилання з токеном).
   */
  readonly kind?: string;
};

export type MailTransport = {
  readonly driver: 'smtp' | 'log';
  send(message: MailMessage): Promise<void>;
};
