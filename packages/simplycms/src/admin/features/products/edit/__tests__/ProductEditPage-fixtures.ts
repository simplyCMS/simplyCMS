// Спільні фікстури сторінок картки (канон 150 рядків на тест).
export const ID = '22222222-2222-4222-8222-222222222222';

const fieldStatus = {
  name: 'current',
  shortDescription: 'current',
  description: 'current',
  metaTitle: 'current',
  metaDescription: 'current',
};

export const aggregate = (hasModifications: boolean, version = 1) => ({
  id: ID,
  version,
  base: {
    sectionId: null,
    sku: 'SKU-1',
    isActive: true,
    isFeatured: false,
    hasModifications,
    stockStatus: 'in_stock',
  },
  texts: {
    uk: {
      name: 'Панель',
      shortDescription: null,
      description: null,
      metaTitle: null,
      metaDescription: null,
      status: 'current',
      fieldStatus,
    },
  },
  paths: { uk: 'panel' },
  modifications: [],
  propertyValues: [],
  images: [],
});

export const LANGUAGES = [
  {
    code: 'uk',
    name: 'Українська',
    status: 'published',
    isDefault: true,
    sortOrder: 0,
    hasPack: true,
  },
];
