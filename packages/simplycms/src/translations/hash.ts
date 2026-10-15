import { createHash } from 'node:crypto';

/**
 * Хеш тексту поля джерела (майстер §3.4): sha256 hex від `NFC` + `trim`.
 *
 * Нормалізація до хешування, щоб один і той самий текст у різних формах
 * Unicode («é» цілим символом чи «e» + акцент) і з пробілами по краях не
 * давав різних хешів і хибних статусів `outdated`. Для rich-тексту викликач
 * передає вже санітизований HTML.
 *
 * Лише сервер: `node:crypto` у клієнтський бандл не потрапляє, тому чисті
 * модулі (`simplycms/domain/translations`) приймають цю функцію аргументом.
 */
export function sourceFieldHash(text: string): string {
  // Типи цього не допускають, але JS-викликач із `null` із БД отримав би
  // незрозуміле «Cannot read properties of null (reading 'normalize')».
  if (typeof text !== 'string')
    throw new TypeError(
      '[simplycms/translations] sourceFieldHash: потрібен рядок',
    );
  return createHash('sha256')
    .update(text.normalize('NFC').trim(), 'utf8')
    .digest('hex');
}
