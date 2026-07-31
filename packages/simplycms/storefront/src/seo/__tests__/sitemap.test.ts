import { describe, expect, it } from 'vitest';
import { buildSitemapXml } from '../sitemap';
import type { StorefrontClient } from '../../client';

/** Відповідь Supabase-запиту, яку віддає мок. */
interface MockResult {
  data: unknown;
  error: unknown;
}

const OK_SECTIONS: MockResult = {
  data: [{ slug: 'shoes', updated_at: '2026-07-01T00:00:00Z' }],
  error: null,
};
const OK_PRODUCTS: MockResult = {
  data: [{ slug: 'boot', updated_at: null, sections: { slug: 'shoes' } }],
  error: null,
};
const FAIL: MockResult = { data: null, error: { message: 'RLS violation' } };

/**
 * Thenable-білдер Supabase: `from(table)` віддає ланцюг, який резолвиться
 * у заготовлений результат для цієї таблиці.
 */
function makeClient(results: Record<string, MockResult>): StorefrontClient {
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.order = chain;
    builder.eq = chain;
    builder.then = <TResult>(onfulfilled: (value: MockResult) => TResult) =>
      Promise.resolve(results[table] ?? { data: [], error: null }).then(
        onfulfilled,
      );
    return builder;
  };
  return { from } as unknown as StorefrontClient;
}

describe('buildSitemapXml: помилки запитів не ковтаються', () => {
  it('успішні запити → sitemap із секціями і товарами', async () => {
    const xml = await buildSitemapXml(
      makeClient({ sections: OK_SECTIONS, products: OK_PRODUCTS }),
      'https://shop.test',
    );

    expect(xml).toContain('<loc>https://shop.test/catalog/shoes</loc>');
    expect(xml).toContain('<loc>https://shop.test/catalog/shoes/boot</loc>');
  });

  it('помилка запиту products → throw (а не «успішний» неповний sitemap)', async () => {
    const client = makeClient({ sections: OK_SECTIONS, products: FAIL });

    await expect(buildSitemapXml(client, 'https://shop.test')).rejects.toThrow(
      /RLS violation/,
    );
  });

  it('помилка запиту sections → throw', async () => {
    const client = makeClient({ sections: FAIL, products: OK_PRODUCTS });

    await expect(buildSitemapXml(client, 'https://shop.test')).rejects.toThrow(
      /RLS violation/,
    );
  });
});
