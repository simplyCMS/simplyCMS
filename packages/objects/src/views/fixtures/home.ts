// Фікстурні view-model-и головної (Р6). Живуть поруч із типами, тому
// оновлюються тим самим PR, що й тип — дрейф структурно неможливий.

import type { Banner } from '../../objects/banner';
import type { HomeViewModel } from '../home';
import type { ProductCardViewModel, ViewModelData } from '../common';

const banner: Banner = {
  id: 'banner-1',
  title: 'Сонячні панелі',
  subtitle: 'Знижки до кінця тижня',
  image_url: '/img/banner-1.jpg',
  desktop_image_url: null,
  mobile_image_url: null,
  buttons: [
    {
      text: 'До каталогу',
      url: '/catalog',
      target: '_self',
      variant: 'primary',
    },
  ],
  placement: 'home',
  section_id: null,
  sort_order: 0,
  is_active: true,
  date_from: null,
  date_to: null,
  schedule_days: null,
  schedule_time_from: null,
  schedule_time_to: null,
  slide_duration: 5000,
  animation_type: 'fade',
  animation_duration: 400,
  overlay_color: null,
  text_position: 'left',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const product: ProductCardViewModel = {
  id: 'product-1',
  name: 'Панель 550 Вт',
  slug: 'panel-550',
  images: ['/img/panel-550.jpg'],
  short_description: 'Монокристал, 25 років гарантії',
  section: { slug: 'panels' },
  stock_status: 'in_stock',
  price: 4200,
  old_price: 4900,
};

/** Товар без фото й без ціни — крайній стан картки. */
const bareProduct: ProductCardViewModel = {
  id: 'product-2',
  name: 'Інвертор без фото',
  slug: 'inverter-no-photo',
  images: [],
  short_description: null,
  section: null,
  stock_status: 'out_of_stock',
  price: null,
  old_price: null,
};

const full: ViewModelData<HomeViewModel> = {
  hero: { banners: [banner] },
  featured: { products: [product, bareProduct] },
  newArrivals: { products: [product] },
  sections: { items: [{ id: 'section-1' }] },
};

/** Порожній магазин: ні банерів, ні добірок, ні кореневих категорій. */
const edge: ViewModelData<HomeViewModel> = {
  hero: { banners: [] },
  featured: { products: [] },
  newArrivals: { products: [] },
  sections: { items: [] },
};

export const homeViewModelFixtures = { full, edge } as const;
