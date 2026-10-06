export {
  METHODS,
  stubDom,
  wrapper,
} from '../../methods/__tests__/render-support';

const base = {
  description: null,
  sortOrder: 0,
  createdAt: new Date(),
  cities: ['Київ', 'Бровари'],
  regions: [],
};

/** Київ — дефолтна, Львів — активна, Одеса — вимкнена. */
export const ZONES = [
  {
    ...base,
    id: 'c0000000-0000-4000-8000-000000000001',
    name: 'Київ',
    isActive: true,
    isDefault: true,
  },
  {
    ...base,
    id: 'c0000000-0000-4000-8000-000000000002',
    name: 'Львів',
    isActive: true,
    isDefault: false,
    sortOrder: 1,
  },
  {
    ...base,
    id: 'c0000000-0000-4000-8000-000000000003',
    name: 'Одеса',
    isActive: false,
    isDefault: false,
    sortOrder: 2,
  },
];

/** Помилка 409 «стан», як її віддає адаптер доменних помилок. */
export const stateConflict = (constraint: string) =>
  Object.assign(new Error(constraint), {
    name: 'AdminConflictError',
    kind: 'state',
    constraint,
  });
