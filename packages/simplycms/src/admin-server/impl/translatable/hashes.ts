import { ValidationError } from 'simplycms/contracts/domain-errors';
import { fieldToWire, toSourceRow } from 'simplycms/domain/translations';
import {
  sourceFieldHash,
  type TranslatableEntity,
} from 'simplycms/translations';

/**
 * Кожне надіслане поле, чиє джерело має текст, мусить мати хеш у
 * `expectedSourceHashes`: без нього перекладач нічого не підтвердив, а запис
 * штампував би хеш поточного джерела без перевірки (сценарій 3 став би
 * сценарієм 2). Поле з порожнім джерелом хеша не має — його не вимагаємо.
 */
export function requireHashes(
  spec: TranslatableEntity,
  patch: Readonly<Record<string, string | null | undefined>>,
  expected: Readonly<Record<string, string>>,
  source: Readonly<Record<string, string | null | undefined>>,
): void {
  const stored = toSourceRow(spec, source, sourceFieldHash).currentHashes;
  const missing = Object.entries(patch)
    .filter(([f, v]) => v !== undefined && stored[f] && !(f in expected))
    .map(([f]) => f);
  if (missing.length > 0)
    throw new ValidationError(
      missing.map((f) => ({
        path: ['expectedSourceHashes', fieldToWire(f)],
        code: 'invalid_type' as const,
      })),
    );
}
