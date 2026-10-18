// Фікстурні view-model-и картки товару (Р6).

import type { ViewModelData } from '../common';

// Фікстури — статичний авторський HTML без користувацького вводу; каст до
// `SanitizedHtml` тут легальний (єдине місце поза `sanitizeRichHtml`).
import type { SanitizedHtml } from '../../sanitized-html';
import type {
  ProductDetailViewModel,
  ProductPropertyValueViewModel,
} from '../product-detail';

const characteristic: ProductPropertyValueViewModel = {
  property_id: 'prop-1',
  value: null,
  numeric_value: 550,
  option_id: null,
  option: null,
  property: {
    id: 'prop-1',
    name: 'Потужність, Вт',
    slug: 'power',
    property_type: 'number',
    has_page: false,
  },
};

const full: ViewModelData<ProductDetailViewModel> = {
  breadcrumbs: [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    { label: 'Панелі', href: '/catalog/panels' },
    { label: 'Панель 550 Вт' },
  ],
  gallery: {
    images: [
      { url: '/img/panel-550.jpg', alt: 'Панель 550 Вт, фронт' },
      // Фото без опису: alt порожній, а не назва товару (Task 17б).
      { url: '/img/panel-550-back.jpg', alt: '' },
    ],
  },
  summary: {
    name: 'Панель 550 Вт',
    sku: 'PNL-550',
    short_description: 'Монокристал, 25 років гарантії',
    discountPercent: 14,
  },
  description: { html: '<p>Панель для дахових систем.</p>' as SanitizedHtml },
  characteristics: { items: [characteristic] },
};

/** Товар без фото, артикула, опису й характеристик — крайній стан. */
const edge: ViewModelData<ProductDetailViewModel> = {
  breadcrumbs: [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    { label: 'Товар без фото' },
  ],
  gallery: { images: [] },
  summary: {
    name: 'Товар без фото',
    sku: null,
    short_description: null,
    discountPercent: null,
  },
  description: { html: null },
  characteristics: { items: [] },
};

export const productDetailViewModelFixtures = { full, edge } as const;

/**
 * Сторінка іншою мовою, де кожне перекладне поле — fallback з основної (`uk`): conformance
 * перевіряє, що view дав кожному такому фрагменту `lang` (І37). Тексти — унікальні маркери,
 * щоб пошук у розмітці не сплутав поля між собою.
 */
export const productDetailFallbackFixture: ViewModelData<ProductDetailViewModel> =
  {
    breadcrumbs: [
      { label: 'Home', href: '/en' },
      { label: 'Крихта основною мовою', lang: 'uk' },
    ],
    gallery: {
      images: [
        {
          url: '/img/fallback.jpg',
          alt: 'Фото основною мовою',
          alt_lang: 'uk',
        },
      ],
    },
    summary: {
      name: 'Назва основною мовою',
      sku: null,
      short_description: 'Короткий опис основною мовою',
      discountPercent: null,
      name_lang: 'uk',
      short_description_lang: 'uk',
    },
    description: {
      html: '<p>Опис основною мовою</p>' as SanitizedHtml,
      lang: 'uk',
    },
    characteristics: {
      items: [
        {
          ...characteristic,
          numeric_value: null,
          value: 'Значення основною мовою',
          value_lang: 'uk',
          property: { ...characteristic.property!, property_type: 'text' },
        },
      ],
    },
  };
