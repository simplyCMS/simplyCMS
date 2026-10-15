import { AwsClient } from 'aws4fetch';
import { describe, expect, it } from 'vitest';
import { mediaKey, s3Driver } from 'simplycms/storage';
import { runDriverContract } from './contract';

// 🔴 Без `S3_*` тест ПАДАЄ, а не skip: контур `test:schema` і так вимагає
// стенд, а мовчазний skip зробив би контракт s3 необов'язковим.
const KEYS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
] as const;

function harnessConfig() {
  const missing = KEYS.filter((k) => !process.env[k]);
  if (missing.length > 0)
    throw new Error(
      `Контракт s3 потребує Garage стенду: не задано ${missing.join(', ')}. ` +
        'Запусти `pnpm harness:up` (він пише S3_* у .env.harness).',
    );
  return {
    driver: 's3' as const,
    endpoint: process.env.S3_ENDPOINT!.replace(/\/+$/, ''),
    region: process.env.S3_REGION!,
    bucket: process.env.S3_BUCKET!,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
  };
}

runDriverContract('s3 (Garage)', async () => ({
  driver: s3Driver(harnessConfig()),
  cleanup: async () => undefined,
}));

// UPSTREAM:GARAGE-INM-1 — живий зонд-сторож: Garage v2.4.1 ігнорує
// `If-None-Match: *`, тому драйвер перевіряє колізію через `HEAD`. Коли цей кейс
// почервоніє (друге `PUT` дасть 412) — Garage виправив поведінку: перегляньте
// запис у docs/architecture/upstream-workarounds.md і приберіть `HEAD` перед `PUT`.
describe('UPSTREAM:GARAGE-INM-1 — Garage досі ігнорує If-None-Match', () => {
  it('другий PUT з If-None-Match: * на той самий ключ НЕ дає 412', async () => {
    const cfg = harnessConfig();
    const client = new AwsClient({
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
      region: cfg.region,
      service: 's3',
    });
    const url = `${cfg.endpoint}/${cfg.bucket}/${mediaKey('image/png')}`;
    const put = async (body: string) => {
      const res = await client.fetch(url, {
        method: 'PUT',
        body,
        headers: { 'if-none-match': '*' },
      });
      await res.body?.cancel();
      return res.status;
    };
    try {
      expect(await put('one')).toBe(200);
      expect(
        await put('two'),
        'UPSTREAM:GARAGE-INM-1 — Garage почав виконувати If-None-Match: переглянь запис у upstream-workarounds.md',
      ).toBe(200);
    } finally {
      await client.fetch(url, { method: 'DELETE' });
    }
  });
});
