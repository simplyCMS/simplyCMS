// Фінальне рев'ю М1 (C-I1): дамп стенда знімається лише з БД зі схемою М1. На БД до
// мультимовності дампер відмовляє ЗРОЗУМІЛО (що бракує і що робити), а не сирим
// `relation "product_translations" does not exist`; на каноні М1 читає весь allowlist.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import * as H from '../apply.mjs';
import { dumpDataset } from '../../../../../scripts/dev-stand/dump-demo-data.mjs';

type Harness = { url: string; teardown: () => Promise<void> };

const withClient = async <T>(
  url: string,
  fn: (c: pg.Client) => Promise<T>,
): Promise<T> => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

describe('дамп стенда: схема джерела (C-I1)', () => {
  let harness: Harness;
  const legacy = H.randomDbName('simplycms_dump_legacy');
  const canon = H.randomDbName('simplycms_dump_canon');

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, legacy);
    await H.createTempDatabase(harness.url, canon);
    // Форма легасі-схеми: тексти, слаг і фото — колонками товару, таблиць М1 немає.
    await withClient(H.withDbName(harness.url, legacy), (c) =>
      c.query(`create table public.sections (id uuid primary key, slug text);
               create table public.products (id uuid primary key, name text, slug text, images jsonb)`),
    );
    await H.applyCanon(H.withDbName(harness.url, canon));
  }, 120_000);

  afterAll(async () => {
    await H.dropTempDatabase(harness.url, legacy);
    await H.dropTempDatabase(harness.url, canon);
    await harness?.teardown();
  });

  it('БД до М1 → відмова з переліком таблиць і вказівкою на README, без сирого relation', async () => {
    const err = await withClient(H.withDbName(harness.url, legacy), (c) =>
      dumpDataset(c).catch((e: unknown) => e),
    );
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain('схема джерела до М1');
    expect(message).toContain('product_translations');
    expect(message).toContain('url_paths');
    expect(message).toContain('scripts/dev-stand/README.md');
    expect(message).not.toMatch(/relation .* does not exist/);
  });

  it('канон М1 → читає весь allowlist без відмови', async () => {
    const dataset = await withClient(H.withDbName(harness.url, canon), (c) =>
      dumpDataset(c),
    );
    expect(Object.keys(dataset)).toContain('product_translations');
  });
});
