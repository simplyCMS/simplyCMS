import { describe, expect, it } from 'vitest';
import { isCoreMigrationName } from '../files';
import { MigrationChecksumError } from '../errors';

// Повідомлення розрізняє файл ядра (baseline змінено → базу створюють заново)
// і чужий файл (плагін/магазин → стара порада «зміна новою міграцією»).
describe('MigrationChecksumError', () => {
  it('файл ядра: називає baseline, до 1.0 і дію (db:demo / новий екземпляр БД)', () => {
    const { message } = new MigrationChecksumError(['0001_init.sql']);
    expect(message).toContain('0001_init.sql');
    expect(message).toContain('baseline платформи змінився');
    expect(message).toContain('до 1.0 базу створюють заново');
    expect(message).toContain('pnpm simplycms db:apply');
    expect(message).toContain('db:demo');
    expect(message).toContain('новий порожній екземпляр БД');
  });

  it('файл плагіна: без слів про baseline, порада «зміна — новою міграцією»', () => {
    const { message } = new MigrationChecksumError([
      '20261014000000_plg_faq_init.sql',
    ]);
    expect(message).toContain('20261014000000_plg_faq_init.sql');
    expect(message).not.toContain('baseline платформи змінився');
    expect(message).not.toContain('до 1.0 базу створюють заново');
    expect(message).toContain('поверніть його вміст');
    expect(message).toContain('новою міграцією');
  });

  it('змішаний список: обидві частини, кожна зі своїми іменами', () => {
    const { message } = new MigrationChecksumError([
      '0003_seed.sql',
      '20261014000000_plg_faq_init.sql',
    ]);
    expect(message).toContain('baseline платформи змінився');
    expect(message).toContain('новою міграцією');
    const [core, own] = message.split('Змінено вже накочені');
    expect(core).toContain('0003_seed.sql');
    expect(core).not.toContain('plg_faq_init');
    expect(own).toContain('20261014000000_plg_faq_init.sql');
    expect(own).not.toContain('0003_seed');
  });

  it('names лишається повним списком', () => {
    const names = ['0001_init.sql', '20261014000000_x.sql'];
    expect(new MigrationChecksumError(names).names).toEqual(names);
  });
});

describe('isCoreMigrationName', () => {
  it('ядро — чотири цифри й підкреслення; таймстамп плагіна — ні', () => {
    expect(isCoreMigrationName('0005_x.sql')).toBe(true);
    expect(isCoreMigrationName('20261014000000_plg_faq_init.sql')).toBe(false);
    expect(isCoreMigrationName('custom.sql')).toBe(false);
  });
});
