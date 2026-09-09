import { z } from 'zod';
import { supabase } from '../client.js';
import { uploadProductImagesFromUrls } from '../storage.js';

// --- Schema ---

export const seedInvertersSchema = z.object({
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe('Preview data without inserting'),
});

export const seedFromJsonSchema = z.object({
  data: z.object({
    section: z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      meta_title: z.string().optional(),
      meta_description: z.string().optional(),
    }),
    properties: z
      .array(
        z.object({
          name: z.string(),
          slug: z.string(),
          property_type: z.enum([
            'text',
            'number',
            'select',
            'multiselect',
            'range',
            'color',
            'boolean',
          ]),
          is_filterable: z.boolean().optional().default(true),
          applies_to: z
            .enum(['product', 'modification'])
            .optional()
            .default('product'),
          options: z
            .array(z.object({ name: z.string(), slug: z.string() }))
            .optional(),
        }),
      )
      .optional(),
    products: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
        short_description: z.string().optional(),
        description: z.string().optional(),
        sku: z.string().optional(),
        price: z.number().positive(),
        old_price: z.number().positive().optional(),
        stock_status: z
          .enum(['in_stock', 'out_of_stock', 'on_order'])
          .optional()
          .default('in_stock'),
        stock_quantity: z.number().int().min(0).optional(),
        images: z.array(z.string()).optional(),
        properties: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .optional()
          .describe('Property slug → value mapping'),
      }),
    ),
  }),
});

// --- Inverter seed data ---

const INVERTER_PRODUCTS = [
  {
    name: 'Інвертор гібридний LUXPOWER SNA6000 6 кВт (2 MPPT)',
    slug: 'invertor-gibrydnyj-luxpower-6kvt-sna6000',
    short_description:
      'Високоефективний сонячний інвертор LUXPOWER SNA 6000 з 2 MPPT контролерами, Wi-Fi моніторинг',
    description: `<h2>LUXPOWER SNA 6000 — гібридний сонячний інвертор 6 кВт</h2>
<p>LUXPOWER SNA 6000 – це високоефективний сонячний інвертор для перетворення постійного струму (DC) в змінний струм (AC) у системах фотоелектричних (PV) сонячних електростанцій.</p>
<h3>Основні характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 6000 Вт максимальна вихідна потужність</li>
<li><strong>MPPT:</strong> 2 MPPT контролери з діапазоном напруги 100В~385В</li>
<li><strong>Вхідна напруга:</strong> широкий діапазон 120-450 В</li>
<li><strong>Захист:</strong> від перевантажень, замикань та високих напруг</li>
<li><strong>Фази:</strong> однофазна або трифазна (до 3 інверторів паралельно)</li>
<li><strong>Масштабування:</strong> до 30 кВт в одно чи трифазну систему</li>
<li><strong>Генератор:</strong> окремий вхід для підключення</li>
<li><strong>Моніторинг:</strong> безкоштовний інтернет-моніторинг (Wi-Fi)</li>
</ul>`,
    sku: 'LUXPOWER-SNA6000',
    price: 37700,
    stock_status: 'in_stock' as const,
    stock_quantity: 5,
    properties: {
      power_kw: 6,
      battery_voltage: '48',
      type: 'hybrid',
      brand: 'luxpower',
      mppt: 'true',
      max_pv_voltage: 450,
    },
  },
  {
    name: 'Гібридний інвертор MUST PV18-1012VPM 1 кВт 12В',
    slug: 'gibrydnyj-invertor-must-pv18-1012vpm-1kvt-12v',
    short_description:
      'Сонячний інвертор MUST PV18-1012VPM з MPPT контролером, чиста синусоїда, 1 кВт, 12В',
    description: `<h2>MUST PV18-1012VPM — гібридний інвертор 1 кВт</h2>
<p>Гібридний інвертор MUST PV18-1012VPM з чистою синусоїдою на виході, інтелектуальним налаштуванням РК-дисплея та вбудованим контролером заряду сонячної батареї.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 1000 Вт</li>
<li><strong>Напруга АКБ:</strong> 12 В</li>
<li><strong>Ефективність:</strong> 90-93%</li>
<li><strong>Контролер:</strong> MPPT</li>
<li><strong>Вихід:</strong> чиста синусоїда</li>
<li><strong>Дисплей:</strong> Smart LCD</li>
<li><strong>Захист:</strong> від надструмів, перевантаження, глибокого розряду</li>
<li><strong>Моніторинг:</strong> USB</li>
</ul>`,
    sku: 'MUST-PV18-1012VPM',
    price: 8270,
    old_price: 16100,
    stock_status: 'in_stock' as const,
    stock_quantity: 10,
    properties: {
      power_kw: 1,
      battery_voltage: '12',
      type: 'hybrid',
      brand: 'must',
      mppt: 'true',
      max_pv_voltage: 100,
    },
  },
  {
    name: 'Гібридний інвертор MUST PV18-3024VPK 3 кВт (ШІМ)',
    slug: 'gibrydnyj-invertor-must-pv18-3024vpk-3kvt',
    short_description:
      'Сонячний інвертор MUST PV18-3024VPK з ШІМ контролером на 60А, чиста синусоїда, 3 кВт, 24В',
    description: `<h2>MUST PV18-3024VPK — гібридний інвертор 3 кВт (ШІМ)</h2>
<p>MUST PV18 – 3024VPK — сонячний інвертор з ШІМ контролером на 60 А, комунікація по CAN-шині, чиста синусоїда на виході.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 3000 Вт номінальна</li>
<li><strong>Потужність PV:</strong> до 1500 Вт</li>
<li><strong>Напруга АКБ:</strong> 24 В</li>
<li><strong>Макс. напруга PV:</strong> 160 В</li>
<li><strong>Зарядний струм:</strong> до 60А від панелей</li>
<li><strong>Контролер:</strong> ШІМ</li>
<li><strong>Вихід:</strong> чиста синусоїда</li>
</ul>`,
    sku: 'MUST-PV18-3024VPK',
    price: 11700,
    stock_status: 'in_stock' as const,
    stock_quantity: 8,
    properties: {
      power_kw: 3,
      battery_voltage: '24',
      type: 'hybrid',
      brand: 'must',
      mppt: 'false',
      max_pv_voltage: 160,
    },
  },
  {
    name: 'Гібридний інвертор MUST PV18-3024VHM 3 кВт',
    slug: 'gibrydnyj-invertor-must-pv18-3024vhm-3kvt',
    short_description:
      'Сонячний інвертор MUST PV18-3024VHM з MPPT контролером на 80А, 3 кВт, 24В',
    description: `<h2>MUST PV18-3024VHM — гібридний інвертор 3 кВт</h2>
<p>MUST PV18 – 3024VHM (MPPT) — сонячний інвертор з MPPT контролером на 80 А.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 3000 Вт</li>
<li><strong>Напруга АКБ:</strong> 24 В</li>
<li><strong>Контролер:</strong> MPPT 80А</li>
<li><strong>Вихід:</strong> чиста синусоїда</li>
</ul>`,
    sku: 'MUST-PV18-3024VHM',
    price: 15425,
    old_price: 16750,
    stock_status: 'in_stock' as const,
    stock_quantity: 6,
    properties: {
      power_kw: 3,
      battery_voltage: '24',
      type: 'hybrid',
      brand: 'must',
      mppt: 'true',
      max_pv_voltage: 160,
    },
  },
  {
    name: 'Гібридний інвертор AXIOMA energy 6000Вт 48В + MPPT 6 кВт',
    slug: 'gibrydnyj-invertor-axioma-energy-6000vt-48v',
    short_description:
      'Гібридний інвертор (ДБЖ) AXIOMA ISMPPT BF DOU G 6000, 48В, чиста синусоїда, МППТ на 6 кВт',
    description: `<h2>AXIOMA energy ISMPPT BF DOU G 6000 — гібридний інвертор 6 кВт</h2>
<p>Гібридний інвертор (ДБЖ) з чистою синусоїдою та широким діапазоном вхідної напруги фотоелектричних модулів 60–450 В.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 6000 Вт</li>
<li><strong>Напруга АКБ:</strong> 48 В</li>
<li><strong>MPPT:</strong> до 6 кВт</li>
<li><strong>Вхідна напруга PV:</strong> 60-450 В</li>
<li><strong>Вихід:</strong> чиста синусоїда</li>
</ul>`,
    sku: 'AXIOMA-ISMPPT-6000',
    price: 48500,
    stock_status: 'in_stock' as const,
    stock_quantity: 3,
    properties: {
      power_kw: 6,
      battery_voltage: '48',
      type: 'hybrid',
      brand: 'axioma',
      mppt: 'true',
      max_pv_voltage: 450,
    },
  },
  {
    name: 'Гібридний інвертор MUST PV18-3224VPM-II 3,2 кВт',
    slug: 'gibrydnyj-invertor-must-pv18-3224vpm-ii-32kvt',
    short_description:
      'Сонячний інвертор MUST PV18-3224VPM з MPPT контролером на 60А, 3.2 кВт, 24В',
    description: `<h2>MUST PV18-3224VPM-II — гібридний інвертор 3,2 кВт</h2>
<p>Гібридний інвертор MUST PV18 – 3324VPM (MPPT) з живленням навантаження з акумулятора та сонячних панелей, зарядка АКБ з мережі чи від сонячних панелей.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 3200 Вт</li>
<li><strong>Потужність PV:</strong> до 3200 Вт</li>
<li><strong>Напруга АКБ:</strong> 24 В</li>
<li><strong>Контролер:</strong> MPPT 60А</li>
<li><strong>Макс. напруга PV:</strong> 160 В</li>
</ul>`,
    sku: 'MUST-PV18-3224VPM-II',
    price: 15425,
    stock_status: 'in_stock' as const,
    stock_quantity: 7,
    properties: {
      power_kw: 3.2,
      battery_voltage: '24',
      type: 'hybrid',
      brand: 'must',
      mppt: 'true',
      max_pv_voltage: 160,
    },
  },
  {
    name: 'Гібридний інвертор MUST PV18-5248 PRO 5,2 кВт',
    slug: 'gibrydnyj-invertor-must-pv18-5248-pro-52kvt',
    short_description:
      'MUST PV18-5248 PRO з MPPT, підтримка CAN-шини BMS, 5.2 кВт, 48В',
    description: `<h2>MUST PV18-5248 PRO — гібридний інвертор 5,2 кВт</h2>
<p>Потужний інвертор з підтримкою комунікації по CAN-шині з BMS акумуляторів (MUST, Pylon, Dyness, li-BMS CAN protocols).</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 5200 Вт</li>
<li><strong>Потужність PV:</strong> до 6000 Вт</li>
<li><strong>Напруга АКБ:</strong> 48 В</li>
<li><strong>Макс. напруга PV:</strong> 450 В</li>
<li><strong>CAN-шина:</strong> підтримка BMS</li>
</ul>`,
    sku: 'MUST-PV18-5248-PRO',
    price: 26750,
    stock_status: 'in_stock' as const,
    stock_quantity: 4,
    properties: {
      power_kw: 5.2,
      battery_voltage: '48',
      type: 'hybrid',
      brand: 'must',
      mppt: 'true',
      max_pv_voltage: 450,
    },
  },
  {
    name: 'Гібридний інвертор MUST PV18-1512VPM 1,5 кВт 12В',
    slug: 'gibrydnyj-invertor-must-pv18-1512vpm-15kvt-12v',
    short_description:
      'MUST PV18-1512VPM з MPPT, чиста синусоїда, 1.5 кВт, 12В, функція холодного запуску',
    description: `<h2>MUST PV18-1512VPM — гібридний інвертор 1,5 кВт</h2>
<p>Пікова ефективність інвертора 90%–93%, ефективність заряду – 98%. Правильна синусоїда напруги, оснащений контролером MPPT.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 1500 Вт</li>
<li><strong>Напруга АКБ:</strong> 12 В</li>
<li><strong>Ефективність:</strong> 90-93%</li>
<li><strong>Контролер:</strong> MPPT</li>
<li><strong>Smart LCD</strong> екран</li>
<li><strong>Холодний запуск:</strong> підтримується</li>
</ul>`,
    sku: 'MUST-PV18-1512VPM',
    price: 14700,
    old_price: 16100,
    stock_status: 'in_stock' as const,
    stock_quantity: 5,
    properties: {
      power_kw: 1.5,
      battery_voltage: '12',
      type: 'hybrid',
      brand: 'must',
      mppt: 'true',
      max_pv_voltage: 100,
    },
  },
  {
    name: 'Гібридний інвертор MUST PV18-5548 ECO 5,5 кВт',
    slug: 'gibrydnyj-invertor-must-pv18-5548-eco-55kvt',
    short_description:
      'MUST PV18-5548 ECO з MPPT 120А, 5.5 кВт, 48В, макс. PV 8000 Вт',
    description: `<h2>MUST PV18-5548 ECO — гібридний інвертор 5,5 кВт</h2>
<p>Потужний інвертор з MPPT контролером на 120А для середніх та великих систем.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 5500 Вт</li>
<li><strong>Потужність PV:</strong> до 8000 Вт</li>
<li><strong>Напруга АКБ:</strong> 48 В</li>
<li><strong>MPPT:</strong> 120А</li>
<li><strong>Макс. напруга PV:</strong> 450 В</li>
<li><strong>Зарядний струм від мережі:</strong> до 100А</li>
</ul>`,
    sku: 'MUST-PV18-5548-ECO',
    price: 22500,
    stock_status: 'in_stock' as const,
    stock_quantity: 3,
    properties: {
      power_kw: 5.5,
      battery_voltage: '48',
      type: 'hybrid',
      brand: 'must',
      mppt: 'true',
      max_pv_voltage: 450,
    },
  },
  {
    name: 'Гібридний інвертор LUXPOWER SNA5000 5 кВт (2 MPPT)',
    slug: 'invertor-gibrydnyj-luxpower-5kvt-sna5000',
    short_description:
      'LUXPOWER SNA5000 з 2 MPPT контролерами, Wi-Fi моніторинг, офіційна гарантія 24 міс',
    description: `<h2>LUXPOWER SNA5000 — гібридний сонячний інвертор 5 кВт</h2>
<p>Інвертор LUXPOWER SNA5000 з офіційною гарантією 24 місяці. 2 MPPT контролери, безкоштовний Wi-Fi моніторинг.</p>
<h3>Характеристики</h3>
<ul>
<li><strong>Потужність:</strong> 5000 Вт</li>
<li><strong>MPPT:</strong> 2 контролери</li>
<li><strong>Напруга АКБ:</strong> 48 В</li>
<li><strong>Моніторинг:</strong> Wi-Fi (безкоштовно)</li>
<li><strong>Гарантія:</strong> 24 місяці офіційна</li>
</ul>`,
    sku: 'LUXPOWER-SNA5000',
    price: 34500,
    stock_status: 'in_stock' as const,
    stock_quantity: 4,
    properties: {
      power_kw: 5,
      battery_voltage: '48',
      type: 'hybrid',
      brand: 'luxpower',
      mppt: 'true',
      max_pv_voltage: 450,
    },
  },
];

const INVERTER_PROPERTIES = [
  {
    name: 'Потужність (кВт)',
    slug: 'power_kw',
    property_type: 'number' as const,
    is_filterable: true,
    applies_to: 'product' as const,
  },
  {
    name: 'Напруга АКБ',
    slug: 'battery_voltage',
    property_type: 'select' as const,
    is_filterable: true,
    applies_to: 'product' as const,
    options: [
      { name: '12 В', slug: '12' },
      { name: '24 В', slug: '24' },
      { name: '48 В', slug: '48' },
    ],
  },
  {
    name: 'Тип інвертора',
    slug: 'type',
    property_type: 'select' as const,
    is_filterable: true,
    applies_to: 'product' as const,
    options: [
      { name: 'Гібридний', slug: 'hybrid' },
      { name: 'Автономний', slug: 'autonomous' },
      { name: 'Мережевий', slug: 'grid' },
    ],
  },
  {
    name: 'Бренд',
    slug: 'brand',
    property_type: 'select' as const,
    is_filterable: true,
    has_page: true,
    applies_to: 'product' as const,
    options: [
      { name: 'LUXPOWER', slug: 'luxpower' },
      { name: 'MUST', slug: 'must' },
      { name: 'AXIOMA energy', slug: 'axioma' },
    ],
  },
  {
    name: 'MPPT контролер',
    slug: 'mppt',
    property_type: 'boolean' as const,
    is_filterable: true,
    applies_to: 'product' as const,
  },
  {
    name: 'Макс. напруга PV (В)',
    slug: 'max_pv_voltage',
    property_type: 'number' as const,
    is_filterable: true,
    applies_to: 'product' as const,
  },
];

// --- Handlers ---

export async function seedInverters(
  input: z.infer<typeof seedInvertersSchema>,
) {
  if (input.dry_run) {
    return {
      content: [
        {
          type: 'text' as const,
          text:
            `DRY RUN — Would create:\n` +
            `- 1 section: "Інвертори"\n` +
            `- ${INVERTER_PROPERTIES.length} properties\n` +
            `- ${INVERTER_PRODUCTS.length} products\n\n` +
            `Products:\n${INVERTER_PRODUCTS.map((p) => `  - ${p.name} (${p.price} грн)`).join('\n')}`,
        },
      ],
    };
  }

  const results: string[] = [];

  // 1. Create section
  const { data: section, error: secError } = await supabase
    .from('sections')
    .insert({
      name: 'Інвертори',
      slug: 'invertory',
      description:
        'Гібридні (сонячні) інвертори — пристрої для перетворення постійного струму від сонячних панелей на змінний 220В',
      is_active: true,
      sort_order: 1,
      meta_title: 'Інвертори — Гібридні сонячні інвертори',
      meta_description:
        'Купити гібридний сонячний інвертор. LUXPOWER, MUST, AXIOMA energy. Доставка по Україні.',
    })
    .select()
    .single();

  if (secError)
    throw new Error(`Failed to create section: ${secError.message}`);
  results.push(`Section created: ${section.id} ("Інвертори")`);

  // 2. Create properties and options
  const propertyMap: Record<string, string> = {}; // slug → id
  const optionMap: Record<string, Record<string, string>> = {}; // propSlug → { optSlug → id }

  for (let i = 0; i < INVERTER_PROPERTIES.length; i++) {
    const prop = INVERTER_PROPERTIES[i];

    const { data: property, error: propError } = await supabase
      .from('section_properties')
      .insert({
        name: prop.name,
        slug: prop.slug,
        property_type: prop.property_type,
        section_id: section.id,
        is_filterable: prop.is_filterable,
        is_required: false,
        has_page: (prop as Record<string, unknown>).has_page === true,
        sort_order: i,
      })
      .select()
      .single();

    if (propError) {
      results.push(
        `Warning: property '${prop.name}' failed: ${propError.message}`,
      );
      continue;
    }

    propertyMap[prop.slug] = property.id;
    results.push(`Property created: ${prop.name}`);

    // Create options
    if ('options' in prop && prop.options) {
      optionMap[prop.slug] = {};
      for (let j = 0; j < prop.options.length; j++) {
        const opt = prop.options[j];
        const { data: option, error: optError } = await supabase
          .from('property_options')
          .insert({
            property_id: property.id,
            name: opt.name,
            slug: opt.slug,
            sort_order: j,
          })
          .select()
          .single();

        if (optError) {
          results.push(
            `Warning: option '${opt.name}' failed: ${optError.message}`,
          );
        } else {
          optionMap[prop.slug][opt.slug] = option.id;
        }
      }
    }

    // Assign to section
    const { error: assignError } = await supabase
      .from('section_property_assignments')
      .insert({
        section_id: section.id,
        property_id: property.id,
        applies_to: prop.applies_to,
        sort_order: i,
      });

    if (assignError) {
      results.push(
        `Warning: assignment for '${prop.name}' failed: ${assignError.message}`,
      );
    }
  }

  // 3. Get default price type
  const { data: defaultPriceType } = await supabase
    .from('price_types')
    .select('id')
    .eq('is_default', true)
    .single();

  if (!defaultPriceType) {
    results.push(
      'Warning: no default price type found — prices will not be set',
    );
  }

  // 4. Get system pickup point for stock
  const { data: pickupPoint } = await supabase
    .from('pickup_points')
    .select('id')
    .eq('is_system', true)
    .limit(1)
    .maybeSingle();

  // 5. Create products
  for (const prod of INVERTER_PRODUCTS) {
    const { data: product, error: prodError } = await supabase
      .from('products')
      .insert({
        name: prod.name,
        slug: prod.slug,
        section_id: section.id,
        short_description: prod.short_description,
        description: prod.description,
        images: [],
        is_active: true,
        is_featured: false,
        has_modifications: false,
        sku: prod.sku,
        stock_status: prod.stock_status,
        meta_title: prod.name,
        meta_description: prod.short_description,
      })
      .select()
      .single();

    if (prodError) {
      results.push(
        `Error: product '${prod.name}' failed: ${prodError.message}`,
      );
      continue;
    }
    results.push(`Product created: ${product.id} (${prod.name})`);

    // Set price
    if (defaultPriceType) {
      const { error: priceError } = await supabase
        .from('product_prices')
        .insert({
          price_type_id: defaultPriceType.id,
          product_id: product.id,
          price: prod.price,
          old_price: prod.old_price ?? null,
        });

      if (priceError)
        results.push(`  Warning: price failed: ${priceError.message}`);
      else
        results.push(
          `  Price: ${prod.price} грн${prod.old_price ? ` (old: ${prod.old_price} грн)` : ''}`,
        );
    }

    // Set stock
    if (pickupPoint && prod.stock_quantity) {
      const { error: stockError } = await supabase
        .from('stock_by_pickup_point')
        .insert({
          pickup_point_id: pickupPoint.id,
          product_id: product.id,
          quantity: prod.stock_quantity,
        });

      if (stockError)
        results.push(`  Warning: stock failed: ${stockError.message}`);
      else results.push(`  Stock: ${prod.stock_quantity} units`);
    }

    // Set property values
    if (prod.properties) {
      for (const [propSlug, rawValue] of Object.entries(prod.properties)) {
        const propertyId = propertyMap[propSlug];
        if (!propertyId) continue;

        const propDef = INVERTER_PROPERTIES.find((p) => p.slug === propSlug);
        if (!propDef) continue;

        const insertData: Record<string, unknown> = {
          product_id: product.id,
          property_id: propertyId,
        };

        if (propDef.property_type === 'number') {
          insertData.numeric_value =
            typeof rawValue === 'number'
              ? rawValue
              : parseFloat(String(rawValue));
          insertData.value = String(rawValue);
        } else if (propDef.property_type === 'select' && optionMap[propSlug]) {
          const optionId = optionMap[propSlug][String(rawValue)];
          if (optionId) {
            insertData.option_id = optionId;
            const opt = propDef.options?.find(
              (o) => o.slug === String(rawValue),
            );
            insertData.value = opt?.name ?? String(rawValue);
          }
        } else if (propDef.property_type === 'boolean') {
          insertData.value = String(rawValue);
        } else {
          insertData.value = String(rawValue);
        }

        const { error: pvError } = await supabase
          .from('product_property_values')
          .insert(insertData);

        if (pvError)
          results.push(
            `  Warning: property '${propSlug}' failed: ${pvError.message}`,
          );
      }
    }
  }

  results.push(`\n=== SEED COMPLETE ===`);
  results.push(`Section: ${section.id}`);
  results.push(`Products: ${INVERTER_PRODUCTS.length}`);
  results.push(`Properties: ${INVERTER_PROPERTIES.length}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: results.join('\n'),
      },
    ],
  };
}

export async function seedFromJson(input: z.infer<typeof seedFromJsonSchema>) {
  const { data: inputData } = input;
  const results: string[] = [];

  // 1. Create section
  const { data: section, error: secError } = await supabase
    .from('sections')
    .insert({
      name: inputData.section.name,
      slug: inputData.section.slug,
      description: inputData.section.description ?? null,
      is_active: true,
      sort_order: 0,
      meta_title: inputData.section.meta_title ?? null,
      meta_description: inputData.section.meta_description ?? null,
    })
    .select()
    .single();

  if (secError) throw new Error(`Section creation failed: ${secError.message}`);
  results.push(`Section: ${section.id} (${section.name})`);

  // 2. Create properties
  const propertyMap: Record<string, { id: string; type: string }> = {};
  const optionMap: Record<string, Record<string, string>> = {};

  if (inputData.properties) {
    for (let i = 0; i < inputData.properties.length; i++) {
      const prop = inputData.properties[i];

      const { data: property, error } = await supabase
        .from('section_properties')
        .insert({
          name: prop.name,
          slug: prop.slug,
          property_type: prop.property_type,
          section_id: section.id,
          is_filterable: prop.is_filterable,
          sort_order: i,
        })
        .select()
        .single();

      if (error) {
        results.push(
          `Warning: property '${prop.name}' failed: ${error.message}`,
        );
        continue;
      }

      propertyMap[prop.slug] = { id: property.id, type: prop.property_type };

      // Options
      if (prop.options) {
        optionMap[prop.slug] = {};
        for (let j = 0; j < prop.options.length; j++) {
          const { data: opt, error: optErr } = await supabase
            .from('property_options')
            .insert({
              property_id: property.id,
              name: prop.options[j].name,
              slug: prop.options[j].slug,
              sort_order: j,
            })
            .select()
            .single();
          if (!optErr && opt) {
            optionMap[prop.slug][prop.options[j].slug] = opt.id;
          }
        }
      }

      // Assign
      await supabase.from('section_property_assignments').insert({
        section_id: section.id,
        property_id: property.id,
        applies_to: prop.applies_to ?? 'product',
        sort_order: i,
      });
    }
    results.push(`Properties: ${Object.keys(propertyMap).length} created`);
  }

  // 3. Get default price type
  const { data: priceType } = await supabase
    .from('price_types')
    .select('id')
    .eq('is_default', true)
    .single();

  // 4. Get pickup point for stock
  const { data: pickupPoint } = await supabase
    .from('pickup_points')
    .select('id')
    .eq('is_system', true)
    .limit(1)
    .maybeSingle();

  // 5. Create products
  let created = 0;
  for (const prod of inputData.products) {
    const inputImages = prod.images ?? [];
    const { data: product, error: prodError } = await supabase
      .from('products')
      .insert({
        name: prod.name,
        slug: prod.slug,
        section_id: section.id,
        short_description: prod.short_description ?? null,
        description: prod.description ?? null,
        images: [],
        is_active: true,
        has_modifications: false,
        sku: prod.sku ?? null,
        stock_status: prod.stock_status ?? 'in_stock',
        meta_title: prod.name,
        meta_description: prod.short_description ?? null,
      })
      .select()
      .single();

    if (prodError) {
      results.push(`Error: '${prod.name}': ${prodError.message}`);
      continue;
    }
    created++;

    if (inputImages.length > 0) {
      const uploaded = await uploadProductImagesFromUrls({
        productId: product.id,
        urls: inputImages,
      });

      const { error: imgError } = await supabase
        .from('products')
        .update({ images: uploaded.images })
        .eq('id', product.id);

      if (imgError) {
        results.push(
          `Warning: images update failed for '${prod.name}': ${imgError.message}`,
        );
      } else {
        results.push(
          `Images uploaded for '${prod.name}': ${uploaded.images.length}`,
        );
      }

      for (const w of uploaded.warnings) {
        results.push(`Warning: ${w}`);
      }
    }

    // Price
    if (priceType) {
      await supabase.from('product_prices').insert({
        price_type_id: priceType.id,
        product_id: product.id,
        price: prod.price,
        old_price: prod.old_price ?? null,
      });
    }

    // Stock
    if (pickupPoint && prod.stock_quantity !== undefined) {
      await supabase.from('stock_by_pickup_point').insert({
        pickup_point_id: pickupPoint.id,
        product_id: product.id,
        quantity: prod.stock_quantity,
      });
    }

    // Properties
    if (prod.properties) {
      for (const [slug, value] of Object.entries(prod.properties)) {
        const propInfo = propertyMap[slug];
        if (!propInfo) continue;

        const insertData: Record<string, unknown> = {
          product_id: product.id,
          property_id: propInfo.id,
        };

        if (propInfo.type === 'number') {
          insertData.numeric_value =
            typeof value === 'number' ? value : parseFloat(String(value));
          insertData.value = String(value);
        } else if (propInfo.type === 'select' && optionMap[slug]) {
          const optId = optionMap[slug][String(value)];
          if (optId) insertData.option_id = optId;
          insertData.value = String(value);
        } else {
          insertData.value = String(value);
        }

        await supabase.from('product_property_values').insert(insertData);
      }
    }
  }

  results.push(`Products: ${created}/${inputData.products.length} created`);

  return {
    content: [
      {
        type: 'text' as const,
        text: results.join('\n'),
      },
    ],
  };
}
