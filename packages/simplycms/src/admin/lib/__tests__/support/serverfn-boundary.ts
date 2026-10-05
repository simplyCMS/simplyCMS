// Реальна межа serverFn для компонентних тестів: помилка, яку «кидає сервер»,
// проходить ТІ САМІ seroval-плагіни, що й у Start (порядок як у
// `runtime/__tests__/domain-error-adapter.test.ts`). `registered: false` —
// контроль «адаптер НЕ зареєстровано» (мутація: прибрати його з
// `src/start.ts` serializationAdapters), де клієнт бачить лише голий Error.
import {
  defaultSerovalPlugins,
  makeSerovalPlugin,
} from '@tanstack/router-core/ssr/client';
import { fromCrossJSON, toCrossJSONAsync } from 'seroval';
import { domainErrorAdapter } from 'simplycms/runtime/domain-error-adapter';
import type { ValidationIssue } from 'simplycms/contracts/domain-errors';

type SerovalPlugins = NonNullable<
  NonNullable<Parameters<typeof toCrossJSONAsync>[1]>['plugins']
>;

export async function throughServerFnBoundary(
  error: Error,
  opts: { registered?: boolean } = {},
): Promise<Error> {
  const plugins = [
    ...(opts.registered === false
      ? []
      : [makeSerovalPlugin(domainErrorAdapter)]),
    ...defaultSerovalPlugins,
  ] as unknown as SerovalPlugins;
  const node = await toCrossJSONAsync(error, { plugins });
  return fromCrossJSON<Error>(node, { plugins, refs: new Map() });
}

/** Те, що кидає сервер (`admin-server/impl/errors.ts` → `ValidationError`). */
export function serverValidationError(
  issues: readonly ValidationIssue[],
): Error {
  return Object.assign(new Error('[admin-server] помилка валідації вводу'), {
    name: 'ValidationError',
    issues,
  });
}
