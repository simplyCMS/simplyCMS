/**
 * Кроки адмінки живого прогону в ОДНІЙ сесії власника: вхід
 * (`./owner-session.mjs`) → каталог (`./admin-catalog.mjs`) →
 * довідники (`./admin-dictionaries.mjs`) → замовлення
 * (`./admin-orders.mjs`, потребує ще й сторінки покупця після воронки:
 * покупець оформлює, власник обробляє) → редагування позицій
 * (`./admin-order-edit.mjs`) → збереження в картках і повернення до списків
 * (`./admin-save-return.mjs`, `./admin-save-return-orders.mjs`) → помилка
 * валідації як помилка поля (`./admin-validation-errors.mjs`, Тема 12) → пагінація
 * списків товарів і замовлень Етапу A (`./admin-lists-pagination.mjs`;
 * ці кроки сіють рядки й прибирають за собою) → доставка
 * (`./admin-shipping.mjs`, потребує й сторінки покупця; прибирає за собою) →
 * знижки й категорії покупців (`./admin-discounts.mjs`: власний новий
 * покупець; прибирає за собою) → покупці й дашборд
 * (`./admin-customers.mjs`: два нові покупці, контакти, категорія, роль, бан,
 * видалення; прибирає за собою) → контент (`./admin-content.mjs`:
 * банери, відгук із фото, ізоляція `pending`, масова модерація; прибирає за
 * собою) → система (`./admin-system.mjs`: профіль, логотип, склад, теми, плагіни;
 * ОСТАННІМ — відновлює стан SQL-ом повз кеш процесу). Окремий browser context —
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
import { runAdminDiscountsStep } from './admin-discounts.mjs';
import { runAdminCustomersStep } from './admin-customers.mjs';
import { runAdminContentStep } from './admin-content.mjs';
import { runAdminSystemStep } from './admin-system.mjs';

export async function runOwnerSteps({
  browser,
  buyerPage,
  base,
  dbUrl,
  storeEnv,
  check,
}) {
  const owner = await openOwnerSession({ browser, base, storeEnv });
  // Рядок входу — той самий, що раніше давав крок каталогу; `pageerror`
  // сторінки входу зараховано сюди, щоб покриття не звузилось.
  const { email, loginErrors } = owner;
  check(
    'адмін: запрошення → пароль → /admin',
    loginErrors.length === 0,
    [email, ...loginErrors].join(' | '),
  );
  // Аргументи кроків: без сторінки воронки й з нею — склад як був у кожного.
  const step = { context: owner.context, base, dbUrl, check };
  const withBuyer = { ...step, buyerPage };
  try {
    await runAdminCatalogStep(step);
    await runAdminDictionariesStep(step);
    // Усередині того самого `try`: контекст власника ще відкритий.
    await runAdminOrdersStep(withBuyer);
    // Редагування позицій — після кроку замовлень, той самий context.
    await runAdminOrderEditStep(withBuyer);
    // Збереження в картках і повернення до списків (TSDB-1) — перед пагінацією.
    await runAdminSaveReturnStep(step);
    await runAdminOrderSaveReturnStep(step);
    // Тема 12: помилка валідації serverFn → помилка поля (сіє й прибирає свій товар).
    await runAdminValidationErrorsStep(step);
    // Пагінація списків — ОСТАННІМ: засів на 55+55 рядків не зачіпає кроки вище.
    await runAdminListsPaginationStep(step);
    // Доставка — ПІСЛЯ пагінації: крок тимчасово додає другу точку й
    // способи, а воронка й `resolveStockPoint` стоять на одній точці демо;
    // прибирає за собою сам.
    await runAdminShippingStep(withBuyer);
    // Знижки й категорії — ПІСЛЯ доставки: оформлює на демо-точці,
    // яку доставка щойно повернула в єдиний стан; ПЕРЕД системою, бо та
    // лишається останньою. Прибирає за собою сам (правило «2+ замовлення»
    // інакше перевело б покупця воронки у «VIP» на замовленні кроку системи).
    await runAdminDiscountsStep(withBuyer);
    // Покупці — ПІСЛЯ знижок (власні покупці A/B у своїх context-ах,
    // тимчасова пара категорій з автоправилом) і ПЕРЕД системою; прибирає
    // за собою сам: покупців, правило, категорії, залишок.
    await runAdminCustomersStep(withBuyer);
    // Контент — ПІСЛЯ покупців (свій новий покупець і гості у власних
    // context-ах) і ПЕРЕД системою; прибирає за собою сам: банер, відгуки,
    // рядки й файли `media`, покупця.
    await runAdminContentStep(withBuyer);
    // Система — ОСТАННІМ у всьому прогоні: `finally` кроку відновлює
    // стан SQL-ом, що оминає кеш процесу `simplycms/site`.
    await runAdminSystemStep(withBuyer);
  } finally {
    await owner.context.close();
  }
}
