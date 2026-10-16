/**
 * Виїмки ратчета миттєвих читань для `live-smoke-no-instant-checks.test.ts`
 * (що стереже і чому — у шапці тесту). Список лише скорочується.
 */
export const INSTANT_CHECK_EXEMPTIONS: readonly {
  /** Шлях відносно `scripts/live-smoke/` (або `../live-smoke.mjs`). */
  file: string;
  /** Нормалізований текст виклику: голова ланцюжка + рядок з читанням. */
  call: string;
  reason: string;
}[] = [
  {
    file: 'admin-catalog-verify.mjs',
    call: "const text = (await page.locator('main').textContent()) ?? '';",
    reason:
      'текст вітринної картки читається після `goto` з `networkidle` (SSR, сторінка вже відрендерена); далі перевіряється наявність назви',
  },
  {
    file: 'admin-content-moderation.mjs',
    call: "(await badge.textContent({ timeout: 10_000 }).catch(() => '0')) ?? '0',",
    reason:
      '`textContent` сам чекає появи бейджа до 10 с; лічильник сторінки читається після `networkidle`, перевірка ≥ 2 не залежить від порядку оновлення',
  },
  {
    file: 'admin-customers-owner.mjs',
    call: 'const found = await row.count();',
    reason:
      'після `row.first().waitFor`; число повертається викликачу для строгої перевірки «рівно 1» (дубль-рядок — дефект)',
  },
  {
    file: 'admin-dictionaries-properties.mjs',
    call: "const text = (await page.locator('main').textContent()) ?? '';",
    reason:
      'текст вітринної сторінки після `goto` (SSR), перевіряється наявність назви опції',
  },
  {
    file: 'admin-dictionaries.mjs',
    call: "const catalogText = (await page.locator('main').textContent()) ?? '';",
    reason:
      'текст вітринної сторінки після `goto` (SSR), перевіряється наявність нового розділу',
  },
  {
    file: 'admin-dictionaries.mjs',
    call: "const offered = await page .getByRole('option', { name: new RegExp(PROP.name) }) .count();",
    reason:
      'спершу `listbox` дочекано (інакше нуль був би «ще не відрендерилось»); очікуваний результат — нуль опцій',
  },
  {
    file: 'admin-discounts-buyer.mjs',
    call: "? parseMoney(((await unit.textContent()) ?? '').split('×')[0] ?? '')",
    reason:
      'читається лише коли `unit.waitFor` вже підтвердив наявність рядка кошика',
  },
  {
    file: 'admin-discounts-buyer.mjs',
    call: 'const named = await items.getByText(discountName, { exact: true }).count();',
    reason:
      'читається після дочеканого `unit` (рядок кошика видно); «назви немає» — на вже відрендереному рядку',
  },
  {
    file: 'admin-discounts-buyer.mjs',
    call: 'const displayed = parseMoney(await page.locator(FIELD.total).textContent());',
    reason:
      'перед читанням `FIELD.total.waitFor()`: підсумок зʼявляється, коли квота вляглась',
  },
  {
    file: 'admin-discounts-owner.mjs',
    call: "const warning = (await dialog.textContent()) ?? '';",
    reason:
      'діалог щойно відкритий кліком і містить статичний текст каскаду; його присутність далі перевіряє клік по кнопці всередині',
  },
  {
    file: 'admin-lists-pagination.mjs',
    call: 'if (!(await button.isEnabled().catch(() => false))) {',
    reason:
      'опитування в циклі після `expectVisible(button)`; помилка читання трактується як «ще disabled» і цикл ретраїть',
  },
  {
    file: 'admin-lists-pagination.mjs',
    call: "rowKeys: (p) => p.locator('tbody tr td.font-medium').allTextContents(),",
    reason:
      'ключі рядків читаються після `waitRows`/дочеканих підвантажень сторінки, читання — предмет перевірки повноти списку',
  },
  {
    file: 'admin-order-edit-ui.mjs',
    call: 'return parseMoney(await cell.textContent());',
    reason: 'читається після `cell.waitFor` на тій самій клітинці',
  },
  {
    file: 'admin-orders-buyer.mjs',
    call: "(await page .locator('text=/В наявності|Немає в наявності|Під замовлення/') .first() .textContent()) ?? '';",
    reason:
      '`textContent` чекає появи бейджа; картка товару — SSR після `networkidle`',
  },
  {
    file: 'admin-orders.mjs',
    call: 'const amount = parseMoney(await cells.nth(2).textContent());',
    reason:
      'клітинки читаються після `row.waitFor` на рядку замовлення; сума й бейдж уже відрендерені разом з рядком',
  },
  {
    file: 'admin-orders.mjs',
    call: "const badge = ((await cells.nth(3).textContent()) ?? '').trim();",
    reason:
      'клітинки читаються після `row.waitFor` на рядку замовлення; сума й бейдж уже відрендерені разом з рядком',
  },
  {
    file: 'admin-save-return-orders.mjs',
    call: "const rowText = await page .locator('tbody tr', { hasText: `SR-${tag}-1` }) .first() .innerText();",
    reason:
      'читається після `waitRows` і свідомої паузи; перевіряється, що рядки на місці',
  },
  {
    file: 'admin-save-return.mjs',
    call: "const names = await page .locator('tbody tr td.font-medium') .allTextContents();",
    reason:
      'читається після `waitRows` і свідомої паузи: перевіряється ВІДСУТНІСТЬ усічення списку',
  },
  {
    file: 'admin-shipping-buyer.mjs',
    call: 'const displayed = parseMoney(await page.locator(FIELD.total).textContent());',
    reason: 'перед читанням `FIELD.total.waitFor()`',
  },
  {
    file: 'admin-shipping-buyer.mjs',
    call: 'const fresh = await page.getByText(newName).count();',
    reason:
      'відсутність нової назви читається після дочеканого `waitText(oldName)` — сторінка вже відрендерена',
  },
  {
    file: 'admin-shipping-orders.mjs',
    call: 'const cardNew = await page.getByText(fx.point.renamed).count();',
    reason:
      'відсутність нової назви точки на картці читається після дочеканого `waitText` старої',
  },
  {
    file: 'admin-system-themes.mjs',
    call: 'return (await page.locator(SOLAR_HEADER).count()) > 0;',
    reason:
      'після `header.w-full` і (для solar) дочекання `SOLAR_HEADER`; негативний випадок «не solar» не має чекати таймаут',
  },
  {
    file: 'admin-validation-errors.mjs',
    call: "const body = (await page.locator('body').innerText()).toString();",
    reason:
      'текст сторінки читається після `field.waitFor` і `expectCount`; перевірка — що повідомлення не дублюється в тілі',
  },
  {
    file: 'funnel.mjs',
    call: "(await page .locator('text=/В наявності|Немає в наявності|Під замовлення/') .first() .textContent()) ?? '';",
    reason:
      '`textContent` чекає появи бейджа; картка товару — SSR після `goto`',
  },
  {
    file: 'funnel.mjs',
    call: "(await page .locator('script[type=\"application/ld+json\"]') .first() .textContent()) ?? '';",
    reason:
      'JSON-LD — частина SSR-розмітки картки, `textContent` чекає елемента',
  },
  {
    file: 'funnel.mjs',
    call: 'const firstName = await page.locator(FIELD.firstName).inputValue();',
    reason: 'після `waitForFunction`, що дочекався непорожнього значення поля',
  },
  {
    file: 'funnel.mjs',
    call: 'const pickedPoint = await page.locator(FIELD.pickupPoint).inputValue();',
    reason:
      'поле пункту видачі читається після дочеканого чекауту (префіл відбувся раніше, `firstName`)',
  },
  {
    file: 'funnel.mjs',
    call: 'const totalText = await page.locator(FIELD.total).textContent();',
    reason: 'перед читанням `FIELD.total.waitFor()`',
  },
  {
    file: 'place-order.mjs',
    call: "const orderNumber = ((await numberEl.textContent()) ?? '').trim();",
    reason: 'після `waitForURL(/order-success/)` і `networkidle`',
  },
];

/**
 * Виїмки структурного гарда «читання БД після очікування зникнення»
 * (`scan-db-reads.ts`). Ключ — `file :: <функція>: <читач> після <очікувач>`
 * (кратність враховано). Список лише скорочується.
 */
const TOAST =
  '`deactivateAndDelete` завершується `waitToast` успіху від сервера — COMMIT уже був, читання безпечне';
export const DETACHED_DB_READ_EXEMPTIONS: readonly {
  file: string;
  call: string;
  reason: string;
}[] = [
  ...[
    'methodByCode',
    'pointNameById',
    'methodByCode',
    'ratesOf',
    'methodStep',
    'methodStep',
    'prepare',
    'leftovers',
  ].map((read) => ({
    file: 'admin-shipping-cleanup.mjs',
    call: `dropShippingConfig: ${read} після deactivateAndDelete`,
    reason: TOAST,
  })),
  ...['defaultPriceTypeName', 'priceTypeCount', 'priceCountByType'].map(
    (read) => ({
      file: 'admin-dictionaries-price-types.mjs',
      call: `runPriceTypesPart: ${read} після detached`,
      reason:
        'читаються ІНШІ рядки (дефолтний тип і тип PRICED із цінами), а не видалений NEW_TYPE; сам NEW_TYPE — через pollUntil',
    }),
  ),
  {
    file: 'admin-dictionaries-price-types.mjs',
    call: 'removeSectionPart: assignmentsOfSection після detached',
    reason:
      'призначення зникають каскадом у ТІЙ САМІЙ транзакції, що й розділ; розділ уже дочекано через pollUntil',
  },
  ...['orderItemsPricing', 'profileByEmail'].map((read) => ({
    file: 'admin-discounts-flow.mjs',
    call: `thresholdPart: ${read} після putInCart`,
    reason:
      '`putInCart` чекає зникнення індикатора кошика, а не видалення рядка; читаються замовлення й профіль після `checkout`',
  })),
  {
    file: 'admin-shipping-setup.mjs',
    call: 'createPart: seedPointStock після addRate',
    reason:
      '`addRate` чекає закриття діалогу створення; seedPointStock ПИШЕ залишок іншої таблиці, а не читає видалене',
  },
  {
    file: 'admin-shipping.mjs',
    call: 'cleanupShippingStep: assertDemoShape після restoreZones',
    reason:
      'assertDemoShape читає замовлення (не зони); зони `restoreZones` перевіряє через pollUntil',
  },
];
