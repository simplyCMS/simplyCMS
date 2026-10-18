// Фінальне рев'ю М1 (I-2, І19 у зворотному напрямку): `languages.add` не бере код, що вже є
// ПОТОЧНОЮ адресою основної мови (префікс мови перекрив би сторінку товару). Історичні адреси
// не блокують.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { setExplicitPath } from 'simplycms/addressing';
import { languagesAdd } from 'simplycms/admin-server/impl';
import {
  ADMIN_STATE_CONSTRAINT,
  AdminConflictError,
} from 'simplycms/contracts/domain-errors';
import { toProblem } from '../../../src/operations/http/problem';
import { useAddressingDb } from './fixtures/addressing-db';
import { exec } from './fixtures/product-aggregate';

describe('languages.add проти поточних адрес основної мови (I-2)', () => {
  const db = useAddressingDb('simplycms_language_code_address');
  const add = (code: string) =>
    exec(languagesAdd, { id: randomUUID(), code, name: code }).catch(
      (e: unknown) => e,
    );
  const exists = async (code: string) =>
    (await db.q(`select 1 from public.languages where code = $1`, [code]))
      .length === 1;

  it('поточна адреса /it → add it = 409 з переліком сутностей (тип, id, адреса)', async () => {
    const id = await db.product('it');
    const err = await add('it');
    expect(err).toBeInstanceOf(AdminConflictError);
    expect(err).toMatchObject({
      kind: 'state',
      constraint: ADMIN_STATE_CONSTRAINT.languageCodeTaken,
      owners: { [`product:${id}`]: 'it' },
    });
    const { status, body } = toProblem(err, 'languages.add');
    expect(status).toBe(409);
    expect(body.conflicts).toEqual([{ type: 'product', id, path: 'it' }]);
    expect(await exists('it')).toBe(false);
  });

  it('історична адреса /de не блокує: add de проходить', async () => {
    const id = await db.product('de');
    await db.shared((d) =>
      setExplicitPath(d, { kind: 'product', id }, 'uk', 'de-new'),
    );
    expect(await add('de')).toMatchObject({ code: 'de', status: 'draft' });
  });

  it('регістр: код pt-BR звіряється як pt-br (адреси — лише нижній регістр, CHECK)', async () => {
    await db.product('pt-br');
    expect(await add('pt-BR')).toBeInstanceOf(AdminConflictError);
    // Нормалізацію тримає БД: шлях з великими літерами в реєстр не потрапить.
    await expect(db.product('IT')).rejects.toThrow(/url_paths_path_format/);
  });
});
