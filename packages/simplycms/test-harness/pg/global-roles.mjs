// vitest `globalSetup` для `test:schema`: ролі кластера готуються ОДИН раз до паралельних
// проєктів (`pg`, `storage`, `mail`). Підготовка — та сама, що в `resolveHarness` для кожного
// файла (`roles.mjs`), тож globalSetup лише робить її раніше: на підготовленому кластері
// `resolveHarness` у каталог ролей нічого не пише, а прелюдія — лише за відмінності стану.
import { resolveHarness } from './up.mjs';

export default async function setup() {
  // Ефемерний фолбек-кластер — свій на кожен файл; його ролі готує `resolveHarness` того файла.
  if (!process.env.PG_HARNESS_URL) return;
  const harness = await resolveHarness();
  await harness.teardown();
}
