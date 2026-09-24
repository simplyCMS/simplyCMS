import { describe, expect, it } from 'vitest';
import { AUTHZ_MATRIX, can } from 'simplycms/auth';
import { parseUploadForm } from '../media/operations';

describe('media.write у матриці authz', () => {
  it('дозволена лише адміну', () => {
    expect(AUTHZ_MATRIX['media.write']).toEqual({ admin: 'any' });
    expect(can({ userId: 'u', roles: ['admin'] }, 'media.write')).toBe(true);
    expect(can({ userId: 'u', roles: ['user'] }, 'media.write')).toBe(false);
    expect(can({ userId: null, roles: [] }, 'media.write')).toBe(false);
  });
});

describe('parseUploadForm', () => {
  const png = () =>
    new File(
      [
        Uint8Array.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
        ]),
      ],
      'a.png',
    );

  const form = (entries: Record<string, string | File>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  };

  it('віддає байти, просніфаний MIME і сутність', async () => {
    const parsed = await parseUploadForm(
      form({
        file: png(),
        entityType: 'product',
        entityId: 'ab000000-0000-4000-8000-000000000000',
      }),
    );
    expect(parsed.mime).toBe('image/png');
    expect(parsed.entityType).toBe('product');
    expect(parsed.entityId).toBe('ab000000-0000-4000-8000-000000000000');
    expect(parsed.bytes.byteLength).toBe(12);
  });

  it('entityId відсутній → null (файл ще не привʼязаний; привʼязка — К4)', async () => {
    const parsed = await parseUploadForm(
      form({ file: png(), entityType: 'banner' }),
    );
    expect(parsed.entityId).toBeNull();
  });

  it.each([
    ['без файлу', form({ entityType: 'product' })],
    ['без entityType', form({ file: png() })],
    ['entityType поза allowlist', form({ file: png(), entityType: 'orders' })],
    [
      'entityId не uuid',
      form({ file: png(), entityType: 'product', entityId: 'нi' }),
    ],
  ])('відбиває: %s', async (_label, fd) => {
    await expect(parseUploadForm(fd)).rejects.toThrow();
  });

  // 🔴 Тут — лише МАПА `reason → код`, бо саму перевірку вмісту доводить
  // юніт `inspectUpload` (Task 2 Step 5b). Дублювати там фікстури сигнатур
  // означало б доводити те саме двічі й розсинхронити при зміні allowlist.
  it('reason від inspectUpload перекладається в код клієнта', async () => {
    const svg = new File(
      [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
      'a.png',
    );
    await expect(
      parseUploadForm(form({ file: svg, entityType: 'product' })),
    ).rejects.toThrow('media/bad-format');

    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png');
    await expect(
      parseUploadForm(form({ file: big, entityType: 'product' })),
    ).rejects.toThrow('media/too-large');
  });
});
