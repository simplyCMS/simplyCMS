/**
 * Довідник каталогу сіду вітрини (С-4, С-14): нові розділи, властивості й
 * товари поверх демо-сіду (`demo-seed.sql`, його не чіпаємо).
 *
 * 🔴 Лише константи: назви й slug-и однакові на кожному прогоні без PRNG.
 * Ціни, залишки, кількості й картинки бере PRNG у `catalog.mts`/`commerce.mts`.
 * Slug-и не перетинаються з демо (`section_properties_slug_key` глобальний).
 *
 * Таблиці — рядками `slug | назва | …` у шаблонних літералах: Prettier їх не
 * розгортає по рядку на поле, і довідник лишається читабельним і коротким.
 */

/** Рядки `a | b | c` → кортежі полів (порожні рядки пропускаються). */
function table(raw: string): string[][] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((cell) => cell.trim()));
}

/** Властивість магазину; опції `select` — [slug, назва] у порядку показу. */
export type PropertySpec = {
  readonly slug: string;
  readonly name: string;
  readonly type: 'number' | 'select';
  readonly options: readonly (readonly [string, string])[];
};

/** Без опцій — числова. Опції: `slug:назва, slug:назва`. */
export const PROPERTIES: readonly PropertySpec[] = table(`
  brend              | Бренд           | solarmax:SolarMax, voltera:VoltEra, sunwise:Sunwise, energo:EnerGo
  yemnist            | Ємність, Вт·год |
  strum              | Струм заряду, А |
  dovzhyna           | Довжина         | 5m:5 м, 10m:10 м, 25m:25 м
  temperatura-svitla | Колір світла    | tepla:Тепле світло, kholodna:Холодне світло
`).map(([slug, name, options]) => ({
  slug: slug!,
  name: name!,
  type: options ? 'select' : 'number',
  options: table(options!.replaceAll(',', '\n').replaceAll(':', '|')).map(
    ([s, n]) => [s!, n!] as const,
  ),
}));

/** Товар: slug, назва, короткий опис. */
export type ProductSpec = {
  readonly slug: string;
  readonly name: string;
  readonly short: string;
};

export type SectionSpec = {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly skuPrefix: string;
  /** Діапазон роздрібної ціни, грн. */
  readonly price: readonly [number, number];
  /** Числова властивість товарів розділу і її діапазон. */
  readonly numeric?: {
    readonly slug: string;
    readonly min: number;
    readonly max: number;
  };
  /** Властивість модифікацій: товари розділу мають варіант на кожну її опцію. */
  readonly modProperty?: string;
  readonly products: readonly ProductSpec[];
};

const products = (raw: string): ProductSpec[] =>
  table(raw).map(([slug, name, short]) => ({
    slug: slug!,
    name: name!,
    short: short!,
  }));

export const SECTIONS: readonly SectionSpec[] = [
  {
    slug: 'zaryadni-stantsii',
    name: 'Зарядні станції',
    description: 'Портативні станції для дому, дачі й подорожей.',
    skuPrefix: 'PS',
    price: [9000, 65000],
    numeric: { slug: 'yemnist', min: 300, max: 3600 },
    products: products(`
      stantsiya-mini-300    | Портативна станція Mini 300 | Компактна станція для ноутбука й телефону.
      stantsiya-trek-600    | Портативна станція Trek 600 | Легка станція для походів.
      stantsiya-home-1200   | Зарядна станція Home 1200   | Резервне живлення для холодильника й роутера.
      stantsiya-home-2000   | Зарядна станція Home 2000   | Живлення котла й насоса під час відключень.
      stantsiya-pro-3600    | Зарядна станція Pro 3600    | Розширювана станція з LiFePO4-елементами.
      stantsiya-kemping-500 | Станція Кемпінг 500         | Станція з ліхтарем і бездротовою зарядкою.
      stantsiya-auto-800    | Станція Авто 800            | Заряджається від прикурювача автомобіля.
    `),
  },
  {
    slug: 'kontrolery-zaryadu',
    name: 'Контролери заряду',
    description: 'MPPT- і PWM-контролери для автономних систем.',
    skuPrefix: 'CC',
    price: [900, 14000],
    numeric: { slug: 'strum', min: 10, max: 100 },
    products: products(`
      kontroler-pwm-20a        | PWM-контролер 20 А            | Базовий контролер для малих систем.
      kontroler-pwm-30a        | PWM-контролер 30 А            | Контролер із USB-виходом.
      kontroler-mppt-40a       | MPPT-контролер 40 А           | Відбір максимальної потужності панелей.
      kontroler-mppt-60a       | MPPT-контролер 60 А           | Для систем 12/24/48 В.
      kontroler-mppt-100a      | MPPT-контролер 100 А          | Промисловий контролер із Wi-Fi.
      kontroler-mppt-bluetooth | MPPT-контролер 30 А Bluetooth | Налаштування зі смартфона.
    `),
  },
  {
    slug: 'kabeli-ta-kriplennya',
    name: 'Кабелі та кріплення',
    description: 'Сонячний кабель, конектори й монтажні системи.',
    skuPrefix: 'CB',
    price: [300, 4500],
    modProperty: 'dovzhyna',
    products: products(`
      kabel-solar-4mm           | Сонячний кабель 4 мм²        | Подвійна ізоляція, стійкий до УФ.
      kabel-solar-6mm           | Сонячний кабель 6 мм²        | Для довгих ліній від масиву.
      kabel-akumulyatornyi-16mm | Акумуляторний кабель 16 мм²  | Гнучкий мідний кабель із клемами.
      podovzhuvach-mc4          | Подовжувач MC4               | Готовий кабель із конекторами MC4.
      kabel-zazemlennya         | Кабель заземлення 10 мм²     | Жовто-зелений, для металоконструкцій.
      kabel-rs485               | Кабель звʼязку RS485         | Для моніторингу інвертора.
    `),
  },
  {
    slug: 'sonyachne-osvitlennya',
    name: 'Сонячне освітлення',
    description: 'Ліхтарі й прожектори з власною панеллю.',
    skuPrefix: 'LT',
    price: [350, 6500],
    modProperty: 'temperatura-svitla',
    products: products(`
      likhtar-sadovyi      | Садовий ліхтар на сонячній батареї     | Автоматично вмикається в сутінках.
      prozhektor-50w       | Прожектор 50 Вт із панеллю             | Пульт і датчик руху в комплекті.
      prozhektor-100w      | Прожектор 100 Вт із панеллю            | Для подвірʼя й паркінгу.
      girlyanda-solar      | Сонячна гірлянда 10 м                  | Вісім режимів світіння.
      svitylnyk-vulychnyi  | Вуличний світильник 200 Вт             | Консольний, для доріг і дворів.
      nastinnyi-svitylnyk  | Настінний світильник із датчиком руху  | Монтаж без проводки.
    `),
  },
];
