// @simplycms/plugin-sdk — єдина поверхня, яку дозволено імпортувати плагіну
// (межа довіри, спека §7; примус — dependency-lint у eslint.config.mjs).

export { definePlugin } from './definePlugin';
// Валідатор живе в plugin-system (його кличе bootstrap) — тут лише реекспорт,
// щоб автор плагіна мав усе з одного імпорту.
export { validatePluginModule } from '@simplycms/plugins';
export { usePluginT } from './usePluginT';
export { usePluginTable, type PluginTablePort } from './usePluginTable';
export { usePluginConfig, type PluginConfigResult } from './usePluginConfig';
export type {
  PluginDefinition,
  PluginMessages,
  SdkPluginModule,
  SlotComponent,
} from './types';
