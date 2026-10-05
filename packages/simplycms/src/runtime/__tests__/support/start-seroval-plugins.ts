// Плагіни seroval, якими Start кодує/розбирає payload serverFn (як у
// domain-error-adapter.test.ts). Винесено сюди, бо `@tanstack/router-core` —
// devDependency ЯДРА і з кореня монорепо не резолвиться: кореневі тести
// (tests/) беруть плагіни цим модулем, не додаючи залежність у корінь.
import { defaultSerovalPlugins } from '@tanstack/router-core/ssr/client';
import type { toJSONAsync } from 'seroval';

type SerovalPlugins = NonNullable<
  NonNullable<Parameters<typeof toJSONAsync>[1]>['plugins']
>;

export const startSerovalPlugins =
  defaultSerovalPlugins as unknown as SerovalPlugins;
