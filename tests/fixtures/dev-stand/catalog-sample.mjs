/**
 * Фікстурний каталожний семпл для `tests/dev-stand-seed.test.ts` (план Р8).
 *
 * Форма дзеркалить те, що віддає `pg` дамперу: рядки з УСІМА колонками, які
 * повернула БД, — зокрема поза allowlist-ом (`created_at`, `owner_email`).
 * Саме на них тест доводить, що санітизація — властивість генератора.
 *
 * Секції навмисно подано дитиною ПЕРЕД батьком, а тексти містять лапки,
 * зворотний слеш і юнікод.
 */

const ROOT_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const PROPERTY_ID = '44444444-4444-4444-8444-444444444444';

export const SAMPLE_DATASET = {
  sections: [
    {
      id: CHILD_ID,
      slug: 'panels-mono',
      name: 'Монопанелі «Сонце»',
      description: 'Дитяча секція',
      image_url: null,
      parent_id: ROOT_ID,
      sort_order: 10,
      is_active: true,
      meta_title: null,
      meta_description: null,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      owner_email: 'owner@example.test',
    },
    {
      id: ROOT_ID,
      slug: 'panels',
      name: "O'Brien Panels",
      description: 'Коренева секція',
      image_url: null,
      parent_id: null,
      sort_order: 0,
      is_active: true,
      meta_title: null,
      meta_description: null,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
    },
  ],
  section_properties: [
    {
      id: PROPERTY_ID,
      section_id: CHILD_ID,
      name: 'Потужність',
      slug: 'power',
      property_type: 'number',
      is_required: false,
      is_filterable: true,
      has_page: false,
      sort_order: 10,
      options: null,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
    },
  ],
  products: [
    {
      id: PRODUCT_ID,
      section_id: CHILD_ID,
      slug: 'panel-mono-450',
      name: "Панель «Сонце» 450 Вт \\ O'Brien ☀️",
      short_description: 'Коротко',
      description: '<p>Опис із <b>HTML</b></p>',
      is_active: true,
      is_featured: true,
      meta_title: null,
      meta_description: null,
      images: [{ url: 'https://cdn.example.test/panel.webp', alt: 'Панель' }],
      has_modifications: false,
      sku: 'PM-450',
      stock_status: 'in_stock',
      updated_at: new Date('2024-02-02T00:00:00.000Z'),
    },
  ],
  product_property_values: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      product_id: PRODUCT_ID,
      property_id: PROPERTY_ID,
      value: '450',
      numeric_value: '450.0000',
      option_id: null,
    },
  ],
  product_prices: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      product_id: PRODUCT_ID,
      modification_id: null,
      price: '4200.00',
      old_price: null,
    },
  ],
};

export const SAMPLE_IDS = { ROOT_ID, CHILD_ID, PRODUCT_ID, PROPERTY_ID };
