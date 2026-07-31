/**
 * Runner скретч-магазину — байт-у-байт копія кореневого: інакше фікс у репо
 * (як-от `pipeline` замість `.pipe()`) не доїде до чужих проєктів, які
 * розгортаються з шаблону `tests/pilot/store-template/`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const read = (relativePath) =>
  readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    'utf8',
  );

it('шаблон пілота містить ту саму копію runner-а', () => {
  for (const file of ['server.mjs', 'server-runtime.mjs']) {
    expect(read(`tests/pilot/store-template/${file}`)).toBe(read(file));
  }
});
