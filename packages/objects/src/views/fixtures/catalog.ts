// Фікстурні view-model-и каталогу та сторінки розділу (Р6).

import type { CatalogSectionViewModel, CatalogViewModel } from '../catalog';
import type { ViewModelData } from '../common';

const catalogFull: ViewModelData<CatalogViewModel> = {
  breadcrumbs: [{ label: 'Головна', href: '/' }, { label: 'Каталог' }],
  productCount: 24,
};

/** Порожня вибірка: фільтри нічого не знайшли. */
const catalogEdge: ViewModelData<CatalogViewModel> = {
  breadcrumbs: [{ label: 'Головна', href: '/' }, { label: 'Каталог' }],
  productCount: 0,
};

const sectionFull: ViewModelData<CatalogSectionViewModel> = {
  breadcrumbs: [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    { label: 'Панелі' },
  ],
  productCount: 12,
  section: {
    id: 'section-1',
    name: 'Панелі',
    slug: 'panels',
    description: '<p>Сонячні панелі для дому й бізнесу.</p>',
  },
};

/** Порожня секція без опису — крайній стан сторінки розділу. */
const sectionEdge: ViewModelData<CatalogSectionViewModel> = {
  breadcrumbs: [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/catalog' },
    { label: 'Порожня секція' },
  ],
  productCount: 0,
  section: {
    id: 'section-2',
    name: 'Порожня секція',
    slug: 'empty',
    description: null,
  },
};

export const catalogViewModelFixtures = {
  full: catalogFull,
  edge: catalogEdge,
} as const;

export const catalogSectionViewModelFixtures = {
  full: sectionFull,
  edge: sectionEdge,
} as const;
