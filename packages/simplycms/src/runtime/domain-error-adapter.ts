import { createSerializationAdapter } from '@tanstack/react-router';
import {
  DOMAIN_ERROR_FIELD_KEYS,
  isDomainErrorName,
  type DomainErrorName,
  type SerializableDomainError,
} from 'simplycms/contracts/domain-errors';

/**
 * Е3-20: реєструється в `createStart(() => ({ serializationAdapters: […] }))`
 * (host `src/start.ts`). Клієнт-безпечний: розпізнає закриту родину
 * (`AdminConflictError`/`AuthzError`) ДУКОМ-ТАЙПІНГОМ за `name` з T0-переліку
 * `contracts/domain-errors` — не імпортує серверні класи
 * (`admin-server/impl`, `auth` — обидва в `contracts/server-only`).
 *
 * 🔴 Пріоритет над `ShallowErrorPlugin`: `createStart`'s
 * `getDefaultSerovalPlugins()` (`@tanstack/start-client-core`) будує масив
 * `[...serializationAdapters.map(makeSerovalPlugin), ...defaultSerovalPlugins]`
 * — наші адаптери ЗАВЖДИ ПЕРЕД router-core плагінами (`ShallowErrorPlugin` —
 * один із них). seroval бере ПЕРШИЙ плагін, чий `test()` збігається
 * (`parsePluginSync`/`parsePluginStream`, `seroval/dist/index.js`) — тому
 * наш `test` (закритий перелік) виграє РАНІШЕ, ніж дійде черга до
 * `value instanceof Error` ShallowErrorPlugin. Виміряно тестом, що будує
 * той самий масив плагінів і прожене реальні `toCrossJSONAsync`/
 * `fromCrossJSON` seroval (`runtime/__tests__/domain-error-adapter.test.ts`).
 *
 * Реєстрація симетрична (`makeSerovalPlugin`): той самий обʼєкт `test`/
 * `toSerializable`/`fromSerializable` виконується і на сервері
 * (серіалізація кинутої помилки), і на клієнті (десеріалізація відповіді)
 * — тому файл НЕ може мати server-only імпортів.
 */
function extractFields(
  name: DomainErrorName,
  value: Error,
): Readonly<Record<string, string | null>> {
  const raw = value as unknown as Record<string, unknown>;
  const out: Record<string, string | null> = {};
  for (const key of DOMAIN_ERROR_FIELD_KEYS[name]) {
    const v = raw[key];
    out[key] = typeof v === 'string' ? v : null;
  }
  return out;
}

export const domainErrorAdapter = createSerializationAdapter({
  // 🔴 Дефіс, не слеш: `key` — це простір імен seroval-тега (`$TSR/t/<key>`),
  // не специфікатор модуля, але `tests/audit-exports.test.ts` регексом
  // ловить будь-який рядковий літерал виду `simplycms/…` як «спожитий
  // субшлях» і вимагає для нього ключа в exports — хибне спрацювання, якого
  // тут не буде.
  key: 'simplycms-domain-error',
  test: (value): value is Error & { readonly name: DomainErrorName } =>
    value instanceof Error && isDomainErrorName(value.name),
  toSerializable: (value): SerializableDomainError => {
    const name = value.name as DomainErrorName;
    return {
      name,
      message: value.message,
      fields: extractFields(name, value),
    };
  },
  fromSerializable: (value: SerializableDomainError): Error =>
    Object.assign(new Error(value.message), {
      name: value.name,
      ...value.fields,
    }),
});
