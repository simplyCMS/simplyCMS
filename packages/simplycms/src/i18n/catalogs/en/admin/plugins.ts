import type { Catalog } from '../../../types';

/** Розширення (плагіни) — дзеркало `uk/admin/plugins.ts`. */
export const messages: Catalog = {
  'admin.plugins.toggleFailed': 'Could not change the status of "{name}"',
  'admin.plugins.toggleFailedShort': 'Could not change the plugin status.',
  'admin.plugins.activated': 'Plugin activated',
  'admin.plugins.deactivated': 'Plugin deactivated',
  'admin.plugins.activatedHint': 'Plugin "{name}" was activated.',
  'admin.plugins.deactivatedHint': 'Plugin "{name}" was deactivated.',

  'admin.plugins.subtitle': 'Manage system plugins and modules',
  'admin.plugins.empty': 'No plugins installed',
  'admin.plugins.emptyHint':
    'Plugins extend what the system can do. Install one to add new capabilities.',
  'admin.plugins.noDescription': 'No description',
  'admin.plugins.moduleMissing': 'Module not found',
  'admin.plugins.hooks': 'Hooks:',
  'admin.plugins.deleteTitle': 'Delete this plugin?',
  'admin.plugins.deleteText':
    'Plugin "{name}" will be deleted. This cannot be undone.',
  'admin.plugins.deleted': 'Plugin deleted',
  'admin.plugins.deletedHint': 'Plugin "{name}" was deleted.',
  'admin.plugins.deleteFailed': 'Could not delete the plugin.',
  'admin.plugins.modules': 'Available modules',
  'admin.plugins.modulesHint': 'Plugin modules registered in the system',
  'admin.plugins.modulesEmpty':
    'No modules registered. Modules register when the application loads.',

  'admin.plugins.enabled': 'Plugin enabled',
  'admin.plugins.disabled': 'Plugin disabled',
  'admin.plugins.notFound': 'Plugin not found',
  'admin.plugins.backToList': 'Back to the list',
  'admin.plugins.deactivate': 'Deactivate',
  'admin.plugins.settingsHint': 'Configure how the plugin behaves',
  'admin.plugins.noSettings': 'This plugin has no settings',
  'admin.plugins.registeredHooks': 'Registered hooks',
  'admin.plugins.registeredHooksHint': 'Extension points the plugin uses',
  'admin.plugins.noHooks': 'No hooks registered',
  'admin.plugins.version': 'Version',
  'admin.plugins.installedAt': 'Installed',
  'admin.plugins.updatedAt': 'Updated',

  'admin.plugins.install': 'Install a plugin',
  'admin.plugins.installTitle': 'Plugin installation',
  'admin.plugins.installHint':
    'Add a new plugin to the system. Pick a registered module or fill the fields manually.',
  'admin.plugins.pickModuleHint': 'Click a module to fill the form',
  'admin.plugins.systemName': 'System name',
  'admin.plugins.systemNameHint': 'Unique name (Latin letters, no spaces)',
  'admin.plugins.displayName': 'Display name',
  'admin.plugins.namePlaceholder': 'My plugin',
  'admin.plugins.authorPlaceholder': 'Your name',
  'admin.plugins.descriptionPlaceholder':
    'A short description of what the plugin does...',
  'admin.plugins.unknownModuleWarning':
    '⚠️ Module "{name}" was not found in the system. The plugin will be registered, but its code must be added to the project for it to work.',
  'admin.plugins.installAction': 'Install',
  'admin.plugins.installed': 'Plugin installed',
  'admin.plugins.installedHint': 'Plugin "{name}" was added to the system.',
  'admin.plugins.installFailed': 'Installation failed',
  'admin.plugins.requiredFields': 'Fill in the required fields',
  'admin.plugins.requiredFieldsHint': 'Name and display name are required',
};
