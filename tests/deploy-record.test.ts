import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  readDeployRecord,
  validateDeployRecord,
  writeDeployRecord,
} from '../packages/cli/src/deploy-record.mjs';

// `.simplycms/deploy.json` (К3-Е8, Task 21): закомічений запис без секретів.
const record = () => ({
  version: 1,
  dokploy: {
    url: 'https://dokploy.example.com',
    projectId: 'proj_1',
    applicationId: 'app_1',
    postgresId: 'pg_1',
  },
  domain: 'shop.example.com',
  bucket: 'shop-media',
  createdAt: '2026-10-13T10:00:00.000Z',
});

const roots: string[] = [];
const tmp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-record-'));
  roots.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

describe('валідатор deploy.json', () => {
  it('коректний запис приймається', () => {
    expect(validateDeployRecord(record())).toEqual(record());
  });

  it('поле поза схемою (apiKey) на верхньому рівні й у dokploy → відмова', () => {
    expect(() => validateDeployRecord({ ...record(), apiKey: 'k' })).toThrow(
      /apiKey/,
    );
    const nested = record();
    Object.assign(nested.dokploy, { apiKey: 'k' });
    expect(() => validateDeployRecord(nested)).toThrow(/apiKey/);
  });

  it('імʼя ресурсу зі словом secret — не секрет: "secret-shop" приймається', () => {
    expect(
      validateDeployRecord({ ...record(), bucket: 'secret-shop' }).bucket,
    ).toBe('secret-shop');
  });

  it('dokploy.url з userinfo, query чи hash → відмова без значення в тексті', () => {
    for (const url of [
      'https://u:p@dokploy.x',
      'https://dokploy.x/?token=abc',
      'https://dokploy.x/#abc',
    ]) {
      const bad = record();
      bad.dokploy.url = url;
      const error = (() => {
        try {
          validateDeployRecord(bad);
        } catch (e) {
          return e as Error;
        }
      })();
      expect(error, url).toBeInstanceOf(Error);
      expect(error!.message).not.toMatch(/u:p|abc/);
    }
  });

  it.each([
    ['version', { version: 2 }],
    ['порожній projectId', { dokploy: { ...record().dokploy, projectId: '' } }],
    ['домен зі схемою', { domain: 'https://shop.example.com' }],
    ['домен зі шляхом', { domain: 'shop.example.com/x' }],
    ['порожній bucket', { bucket: ' ' }],
    ['createdAt не дата', { createdAt: 'вчора' }],
  ])('%s → відмова', (_name, patch) => {
    expect(() => validateDeployRecord({ ...record(), ...patch })).toThrow();
  });

  it('відсутнє поле → відмова; не обʼєкт → відмова', () => {
    const rest: Partial<ReturnType<typeof record>> = record();
    delete rest.bucket;
    expect(() => validateDeployRecord(rest)).toThrow(/bucket/);
    expect(() => validateDeployRecord([])).toThrow();
  });
});

describe('читання й запис', () => {
  it('файлу немає → null; запис → читання дає той самий обʼєкт', () => {
    const root = tmp();
    expect(readDeployRecord(root)).toBeNull();
    writeDeployRecord(root, record());
    expect(readDeployRecord(root)).toEqual(record());
    expect(readFileSync(join(root, '.simplycms/deploy.json'), 'utf8')).toMatch(
      /\n$/,
    );
  });

  it('невалідний запис на диск не потрапляє', () => {
    const root = tmp();
    expect(() => writeDeployRecord(root, { ...record(), apiKey: 'k' })).toThrow(
      /apiKey/,
    );
    expect(readDeployRecord(root)).toBeNull();
  });

  it('битий JSON і невалідний файл кидають (status кладе це в unknown)', () => {
    const root = tmp();
    mkdirSync(join(root, '.simplycms'));
    writeFileSync(join(root, '.simplycms/deploy.json'), '{bad');
    expect(() => readDeployRecord(root)).toThrow();
    writeFileSync(join(root, '.simplycms/deploy.json'), '{"version":1}');
    expect(() => readDeployRecord(root)).toThrow();
  });
});
