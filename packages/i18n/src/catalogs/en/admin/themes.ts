import type { Catalog } from '../../../types';

/** Теми оформлення — дзеркало `uk/admin/themes.ts`. */
export const messages: Catalog = {
  'admin.themes.title': 'Themes',
  'admin.themes.subtitle': 'Manage the look and feel of the store',
  'admin.themes.empty': 'No themes registered',
  'admin.themes.emptyHint':
    'Themes are added through project code and DB migrations',
  'admin.themes.author': 'Author:',
  'admin.themes.activateTitle': 'Activate this theme?',
  'admin.themes.activateText':
    'Theme "{name}" will be activated. Changes apply to the site immediately.',
  'admin.themes.activated': 'Theme activated',
  'admin.themes.activatedStale':
    'Theme activated, but the storefront cache was not cleared',
  'admin.themes.appliedOnSite': 'Changes applied on the site',
  'admin.themes.activateFailed': 'Could not activate the theme',
  'admin.themes.settingsSavedStale':
    'Settings saved, but the storefront cache was not cleared',
  'admin.themes.notFound': 'Theme not found',
  'admin.themes.back': 'Go back',
  'admin.themes.settingsSubtitle': 'Configure the look of the theme',
  'admin.themes.noSettings': 'This theme has no settings',
};
