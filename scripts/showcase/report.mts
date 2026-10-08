/**
 * Підсумок команди: усе, що треба, щоб стартувати магазин на засіяній базі.
 *
 * 🔴 Паролі власника, другого адміна й покупців друкуються свідомо (С-4,
 * С-9): це локальний стенд `@showcase.test`, а без пароля ніхто з них не
 * зайде ні в адмінку, ні в кабінет.
 */
import {
  SHOWCASE_OWNER_EMAIL,
  SHOWCASE_OWNER_PASSWORD,
  type ShowcaseEnv,
} from './env.mts';
import {
  BUYER_COUNT,
  SHOWCASE_BUYER_PASSWORD,
  SHOWCASE_MANAGER_EMAIL,
  SHOWCASE_MANAGER_PASSWORD,
} from './people.mts';

export type ShowcaseReport = {
  readonly env: ShowcaseEnv;
  readonly db: 'created' | 'recreated';
};

/** Рядки звіту (окремо від друку — так їх можна перевірити без консолі). */
export function reportLines({ env, db }: ShowcaseReport): string[] {
  const vars =
    `DATABASE_URL=${env.databaseUrl} BETTER_AUTH_SECRET=${env.authSecret} ` +
    `MEDIA_ROOT=${env.mediaRoot} VITE_SITE_URL=${env.siteUrl}`;
  return [
    '',
    `[showcase] готово (база ${db === 'created' ? 'створена' : 'перестворена'}):`,
    `  DATABASE_URL=${env.databaseUrl}`,
    `  BETTER_AUTH_SECRET=${env.authSecret}`,
    `  MEDIA_ROOT=${env.mediaRoot}`,
    `  VITE_SITE_URL=${env.siteUrl}`,
    '',
    '  Власник (лише локалка):',
    `    email:  ${SHOWCASE_OWNER_EMAIL}`,
    `    пароль: ${SHOWCASE_OWNER_PASSWORD}`,
    `  Другий адмін: ${SHOWCASE_MANAGER_EMAIL} / ${SHOWCASE_MANAGER_PASSWORD}`,
    `  Покупці: buyer-01…buyer-${BUYER_COUNT}@showcase.test / ${SHOWCASE_BUYER_PASSWORD}`,
    '',
    '  Запуск магазину:',
    `    pnpm build && ${vars} pnpm start`,
  ];
}

export function printReport(report: ShowcaseReport): void {
  console.log(reportLines(report).join('\n'));
}
