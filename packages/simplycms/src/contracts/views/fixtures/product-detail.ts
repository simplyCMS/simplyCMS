// Фікстурні view-model-и картки товару (Р6).

import type { ViewModelData } from '../common';
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
  gallery: { images: ['/img/panel-550.jpg', '/img/panel-550-back.jpg'] },
  summary: {
    name: 'Панель 550 Вт',
    sku: 'PNL-550',
    short_description: 'Монокристал, 25 років гарантії',
    discountPercent: 14,
  },
  description: { html: '<p>Панель для дахових систем.</p>' },
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
