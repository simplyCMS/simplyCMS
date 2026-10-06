/**
 * Кроки адмінки живого прогону в ОДНІЙ сесії власника: вхід
 * (`./owner-session.mjs`) → каталог К3-Е3 (`./admin-catalog.mjs`) →
 * довідники К3-Е4 (`./admin-dictionaries.mjs`) → замовлення К3-Е5
 * (`./admin-orders.mjs`, потребує ще й сторінки покупця після воронки:
 * покупець оформлює, власник обробляє) → редагування позицій К3-Е5б
 * (`./admin-order-edit.mjs`) → збереження в картках і повернення до списків
 * (`./admin-save-return.mjs`, `./admin-save-return-orders.mjs`) → помилка
 * валідації як помилка поля (`./admin-validation-errors.mjs`, Тема 12) → пагінація
 * списків товарів і замовлень Етапу A (`./admin-lists-pagination.mjs`;
 * ці кроки сіють рядки й прибирають за собою) → доставка К3-Е6а
 * (`./admin-shipping.mjs`, потребує й сторінки покупця; прибирає за собою). Окремий browser context —
 * сесія власника не змішується із сесією покупця воронки; кожен крок
 * відкриває свою сторінку зі своїм лічильником `pageerror`, а контекст
 * закривається тут, у `finally`. Виніс із `live-smoke.mjs` — канон 150 рядків.
 */
import { openOwnerSession } from './owner-session.mjs';
import { runAdminCatalogStep } from './admin-catalog.mjs';
import { runAdminDictionariesStep } from './admin-dictionaries.mjs';
import { runAdminOrdersStep } from './admin-orders.mjs';
import { runAdminOrderEditStep } from './admin-order-edit.mjs';
import { runAdminSaveReturnStep } from './admin-save-return.mjs';
import { runAdminOrderSaveReturnStep } from './admin-save-return-orders.mjs';
import { runAdminListsPaginationStep } from './admin-lists-pagination.mjs';
import { runAdminValidationErrorsStep } from './admin-validation-errors.mjs';
import { runAdminShippingStep } from './admin-shipping.mjs';

export async function runOwnerSteps({
  browser,
  buyerPage,
  base,
  dbUrl,
  storeEnv,
  check,
}) {
  const owner = await openOwnerSession({ browser, base, storeEnv });
  // Рядок входу — той самий, що до Е4 давав крок каталогу; `pageerror`
  // сторінки входу зараховано сюди, щоб покриття не звузилось.
  const { email, loginErrors } = owner;
  check(
    'адмін: запрошення → пароль → /admin',
    loginErrors.length === 0,
    [email, ...loginErrors].join(' | '),
  );
  try {
    await runAdminCatalogStep({ context: owner.context, base, dbUrl, check });
    await runAdminDictionariesStep({
      context: owner.context,
      base,
      dbUrl,
      check,
    });
    // Усередині того самого `try`: контекст власника ще відкритий.
    await runAdminOrdersStep({
      context: owner.context,
      buyerPage,
      base,
      dbUrl,
      check,
    });
    // Редагування позицій К3-Е5б — після кроку замовлень Е5, той самий context.
    await runAdminOrderEditStep({
      context: owner.context,
      buyerPage,
      base,
      dbUrl,
      check,
    });
    // Збереження в картках і повернення до списків (TSDB-1) — перед пагінацією.
    await runAdminSaveReturnStep({
      context: owner.context,
      base,
      dbUrl,
      check,
    });
    await runAdminOrderSaveReturnStep({
      context: owner.context,
      base,
      dbUrl,
      check,
    });
    // Тема 12: помилка валідації serverFn → помилка поля (сіє й прибирає свій товар).
    await runAdminValidationErrorsStep({
      context: owner.context,
      base,
      dbUrl,
      check,
    });
    // Пагінація списків — ОСТАННІМ: засів на 55+55 рядків не зачіпає кроки вище.
    await runAdminListsPaginationStep({
      context: owner.context,
      base,
      dbUrl,
      check,
    });
    // Доставка К3-Е6а — ПІСЛЯ пагінації: крок тимчасово додає другу точку й
    // способи, а воронка й `resolveStockPoint` стоять на одній точці демо;
    // прибирає за собою сам.
    await runAdminShippingStep({
      context: owner.context,
      buyerPage,
      base,
      dbUrl,
      check,
    });
  } finally {
    await owner.context.close();
  }
}
