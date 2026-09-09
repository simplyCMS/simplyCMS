import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_PATH = join(REPO, 'docs', 'marketplace', 'index.sample.json');

/**
 * Машинний контракт формату запису маркетплейс-індексу (план Фази 4, Р11).
 * Схема тут і Є контрактом v1 — окремого модуля вона свідомо не має, бо
 * репозиторій реального індексу (`simplycms/marketplace`) лежить поза цим
 * монорепо (дія власника); тут перевіряється лише зразок,
 * `docs/marketplace/index.sample.json`.
 */

// Базове (unscoped) імʼя пакета: усе після останнього "/" (для scoped-пакетів)
// або весь рядок (для unscoped).
function basename(pkg: string): string {
  const slash = pkg.lastIndexOf('/');
  return slash === -1 ? pkg : pkg.slice(slash + 1);
}

// Неймінг за Р1: unscoped/сторонньо-scoped пакет — базове імʼя починається
// з `simplycms-theme-`/`simplycms-plugin-`; референс-пакети ядра — виняток
// тієї ж природи (`@simplycms/theme-<name>`/`@simplycms/plugin-<name>`).
function matchesNamingConvention(
  pkg: string,
  type: 'theme' | 'plugin',
): boolean {
  const prefix = `simplycms-${type}-`;
  if (pkg.startsWith('@simplycms/')) {
    return basename(pkg).startsWith(`${type}-`);
  }
  return basename(pkg).startsWith(prefix);
}

const repositorySchema = z.object({
  type: z.literal('git'),
  url: z.string().url(),
  directory: z.string().min(1).optional(),
});

const engineSchema = z.object({
  simplycms: z.string().min(1),
});

// Вимога Р11: `description` — англійською (метадані реєстру, не UI-каталог
// i18n). Точну мову зовнішнім чекером не звіримо — забороняємо кириличні
// символи як мінімальний машинний сигнал.
const englishDescriptionSchema = z
  .string()
  .min(1)
  .refine((value) => !/[Ѐ-ӿ]/.test(value), {
    message: 'description має бути англійською (кирилиця заборонена)',
  });

const marketplaceEntrySchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  type: z.enum(['theme', 'plugin']),
  package: z.string().min(1),
  version: z.string().min(1),
  description: englishDescriptionSchema,
  license: z.string().min(1),
  engines: engineSchema,
  author: z.string().min(1),
  repository: repositorySchema,
});

const marketplaceIndexSchema = z.object({
  version: z.literal(1),
  entries: z.array(marketplaceEntrySchema),
});

type MarketplaceEntry = z.infer<typeof marketplaceEntrySchema>;

describe('маркетплейс-індекс: контракт формату (Фаза 4, Р11)', () => {
  const raw = JSON.parse(readFileSync(SAMPLE_PATH, 'utf8')) as unknown;

  it('index.sample.json відповідає Zod-схемі', () => {
    expect(() => marketplaceIndexSchema.parse(raw)).not.toThrow();
  });

  const parsed = marketplaceIndexSchema.parse(raw);

  it('містить хоча б два записи (зразок — theme + plugin)', () => {
    expect(parsed.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('package унікальний серед усіх записів', () => {
    const packages = parsed.entries.map((entry) => entry.package);
    expect(new Set(packages).size).toBe(packages.length);
  });

  describe.each(parsed.entries)(
    'запис "$package"',
    (entry: MarketplaceEntry) => {
      it('package відповідає неймінгу Р1', () => {
        expect(matchesNamingConvention(entry.package, entry.type)).toBe(true);
      });
    },
  );

  it('референс-теми ядра присутні зразком (@simplycms/theme-solarstore)', () => {
    const solarstore = parsed.entries.find(
      (entry) => entry.package === '@simplycms/theme-solarstore',
    );
    expect(solarstore?.type).toBe('theme');
  });

  it('референс-плагіни ядра присутні зразком (@simplycms/plugin-faq)', () => {
    const faq = parsed.entries.find(
      (entry) => entry.package === '@simplycms/plugin-faq',
    );
    expect(faq?.type).toBe('plugin');
  });
});

describe('matchesNamingConvention: негативні кейси Р1', () => {
  it('відхиляє пакет без потрібного префікса', () => {
    expect(matchesNamingConvention('my-cool-theme', 'theme')).toBe(false);
  });

  it('відхиляє чужий scope без базового префікса', () => {
    expect(matchesNamingConvention('@vendor/aurora', 'theme')).toBe(false);
  });

  it('приймає сторонній scope з базовим префіксом', () => {
    expect(
      matchesNamingConvention('@vendor/simplycms-theme-aurora', 'theme'),
    ).toBe(true);
  });

  it('відхиляє неймінг плагіна для типу theme і навпаки', () => {
    expect(matchesNamingConvention('simplycms-plugin-faq', 'theme')).toBe(
      false,
    );
  });
});
