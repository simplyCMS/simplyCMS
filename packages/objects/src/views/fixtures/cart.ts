// Фікстурні view-model-и кошика (Р6).

import type { CartViewModel } from '../cart';
import type { ViewModelData } from '../common';

const full: ViewModelData<CartViewModel> = {
  breadcrumbs: [{ label: 'Головна', href: '/' }, { label: 'Кошик' }],
  itemCount: 3,
};

/** Порожній кошик — обовʼязковий крайній стан conformance. */
const edge: ViewModelData<CartViewModel> = {
  breadcrumbs: [{ label: 'Головна', href: '/' }, { label: 'Кошик' }],
  itemCount: 0,
};

export const cartViewModelFixtures = { full, edge } as const;
