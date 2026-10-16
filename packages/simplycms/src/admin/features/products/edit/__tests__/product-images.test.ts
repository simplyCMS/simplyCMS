import { describe, expect, it } from 'vitest';
import { imageKeys, withScopedImages } from '../product-images';

const img = (id: string, key: string, order: number, mod?: string) => ({
  id,
  storageKey: key,
  sortOrder: order,
  ...(mod && { modificationId: mod }),
  alt: { uk: 'a' },
  overrides: {},
});

describe('фото картки за областю (товар / модифікація)', () => {
  it('imageKeys віддає ключі потрібної області за порядком', () => {
    const all = [img('1', 'b', 1), img('2', 'a', 0), img('3', 'm', 0, 'M')];
    expect(imageKeys(all, undefined)).toEqual(['a', 'b']);
    expect(imageKeys(all, 'M')).toEqual(['m']);
  });

  it('наявний ключ зберігає id та alt, новий отримує свіжий id; чужа область не чіпається', () => {
    const all = [img('1', 'a', 0), img('3', 'm', 0, 'M')];
    const next = withScopedImages(all, undefined, ['n', 'a']);
    expect(next.find((i) => i.storageKey === 'a')).toMatchObject({
      id: '1',
      sortOrder: 1,
      alt: { uk: 'a' },
    });
    const fresh = next.find((i) => i.storageKey === 'n')!;
    expect(fresh.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.sortOrder).toBe(0);
    expect(next.find((i) => i.storageKey === 'm')?.id).toBe('3');
  });

  it('прибраний ключ зникає', () => {
    expect(withScopedImages([img('1', 'a', 0)], undefined, [])).toEqual([]);
  });
});
