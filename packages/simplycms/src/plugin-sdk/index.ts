// simplycms/plugin-sdk — єдина поверхня, яку дозволено імпортувати плагіну
// (межа довіри, спека §7; примус — dependency-lint у eslint.config.mjs).

export { definePlugin } from './definePlugin';
// Валідатор живе в plugin-system (його кличе bootstrap) — тут лише реекспорт,
// щоб автор плагіна мав усе з одного імпорту.
//
// 🔴 Не з барелю `simplycms/plugins`, а прямо з модуля: барель тягне ще й
// lifecycle адмінки, який досі ходить у БД через supabase-js. Через цей
// реекспорт PostgREST потрапляв у КОЖЕН чанк, що імпортує SDK, — тобто в
// слоти вітрини. Валідатор — чиста функція без стану, тож дублювання його
// коду в бандлі SDK нічого не коштує.
export { validatePluginModule } from '../plugins/validatePluginModule';
export { usePluginT } from './usePluginT';
export { usePluginTable, type PluginTablePort } from './usePluginTable';
export { usePluginConfig, type PluginConfigResult } from './usePluginConfig';
export type {
  PluginDefinition,
  PluginMessages,
  SdkPluginModule,
  SlotComponent,
} from './types';
