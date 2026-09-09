import type { Catalog } from '../../../types';

/** Загальні налаштування — дзеркало `uk/admin/settings.ts`. */
export const messages: Catalog = {
  'admin.settings.subtitle': 'General system settings',
  'admin.settings.stock': 'Stock management',
  'admin.settings.stockHint': 'Automatic product stock accounting',
  'admin.settings.decreaseStock': 'Decrease stock when an order is placed',
  'admin.settings.decreaseStockHint':
    'When enabled, the system automatically decreases the stock quantity as a new order is created',
  'admin.settings.enabledCase':
    '• When enabled: as a customer places an order, stock is decreased by the ordered quantity automatically',
  'admin.settings.disabledCase':
    '• When disabled: stock is not changed automatically, an administrator manages it by hand',
  'admin.settings.warehouseNote':
    '• Stock is decreased at the warehouse specified in the order (pickup point), or at the first available one',
};
