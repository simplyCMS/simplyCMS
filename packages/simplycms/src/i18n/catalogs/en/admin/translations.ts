import type { Catalog } from '../../../types';

/** Переклади сутностей у картках адмінки — дзеркало `uk/admin/translations.ts`. */
export const messages: Catalog = {
  'admin.translations.source': 'source',
  'admin.translations.languages': 'Languages',
  'admin.translations.status.current': 'Up to date',
  'admin.translations.status.outdated': 'Outdated',
  'admin.translations.status.missing': 'Not translated',
  'admin.translations.status.outdatedHint':
    'The source changed after this translation',
  'admin.translations.conflict.title': 'Someone else changed this product',
  'admin.translations.conflict.description':
    'Someone saved this product before you. Your changes are still in the form. Reloading fetches the current data and discards anything unsaved.',
  'admin.translations.conflict.reload': 'Reload',
  'admin.translations.conflict.keep': 'Keep my changes',
  'admin.translations.path.label': 'Address (URL) for {language}',
  'admin.translations.path.save': 'Save address',
  'admin.translations.path.saved': 'Address saved',
  'admin.translations.hasErrors': 'Has errors',
  'admin.translations.path.adjusted': 'The server adjusted the address: {path}',
  'admin.translations.nothingToSave': 'There is nothing to save',
  'admin.translations.loadFailed': 'Could not load the product',
  'admin.translations.retry': 'Try again',
  'admin.translations.unsavedChildren':
    'Changes to modifications, values and photos are saved with the card Save button',
};
