import { isProductionRuntime } from 'simplycms/env';
import type { MailTransport } from './types';

/**
 * Драйвер без доставки: пише лист у лог процесу.
 *
 * 🔴 Режим визначається на КОЖНОМУ листі через `isProductionRuntime(process.env)`
 * (Р16), а не при створенні: `server.mjs` ставить `NODE_ENV=production` до
 * першого запиту, і власної перевірки `NODE_ENV` тут бути не повинно. Поза продом
 * друкується повний `text` (dev-канал: посилання потрібне розробникові). У проді —
 * лише «Кому / Тема / тип»: лог контейнера читає не лише власник, а посилання
 * скидання пароля чи запрошення — секрет (Е8-С1).
 */
export function logTransport(
  log: (line: string) => void = (line) => console.warn(line),
): MailTransport {
  return {
    driver: 'log',
    async send(m) {
      const prod = isProductionRuntime(process.env);
      log(
        `[simplycms/mail] Лист НЕ надіслано (SMTP не налаштовано). Кому: ${m.to}. Тема: ${m.subject}.` +
          (prod ? ` Тип: ${m.kind ?? 'не вказано'}.` : `\n${m.text}`),
      );
    },
  };
}
