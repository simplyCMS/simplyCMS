import type { Catalog } from '../../../types';

/** Дзеркало `uk/admin/customerCategories.ts`. */
export const messages: Catalog = {
  'admin.customerCategories.categories.makeDefault': 'Make default',
  'admin.customerCategories.categories.defaultSet': 'Default category changed',
  'admin.customerCategories.categories.defaultLocked':
    'The default category cannot be deleted',
  'admin.customerCategories.categories.notFound': 'Category not found',
  'admin.customerCategories.categories.deleteWarning':
    'Only a category with no customers, auto-rules or discount-condition references can be deleted.',
  'admin.customerCategories.rules.run': 'Run all rules',
  'admin.customerCategories.rules.runResult':
    'Checked: {checked}, changed: {changed}',
  'admin.customerCategories.rules.runFailed':
    '{failed} customers were not processed — see the server log',
  'admin.customerCategories.rules.utmHint':
    'UTM tags are not collected automatically yet: a rule with this condition fires only for customers whose profile already has the tag',
  'admin.customerCategories.rules.howItWorks':
    'Rules run after every placed order and via the "Run all rules" button. The first rule by priority whose condition holds applies; a customer with no category counts as being in the default one.',
  'admin.customerCategories.rules.notFound': 'Rule not found',
  'admin.customerCategories.rules.removeCondition': 'Remove condition',
  'admin.customerCategories.rules.conditionsInvalid':
    'Fill in every condition: numeric fields accept numbers only',
  'admin.customerCategories.rules.field.utmSource': 'UTM Source',
  'admin.customerCategories.rules.field.utmCampaign': 'UTM Campaign',
};
