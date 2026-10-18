// Фінальне рев'ю М1 (A M-2): неіснуючий розділ у `products.create`/`saveDescription` — 400 на
// полі `sectionId`, а не 409 `reference` із сирим іменем обмеження.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { productsCreate } from 'simplycms/admin-server/impl';
import { useAddressingDb } from './fixtures/addressing-db';
import { create, exec, saveDescription } from './fixtures/product-aggregate';

describe('посилання на розділ у командах товару (A M-2)', () => {
  useAddressingDb('simplycms_product_section_ref');
  const issues = (e: unknown) => (e as ValidationError).issues;

  it('create з неіснуючим sectionId → 400 на [sectionId]', async () => {
    const err = await exec(productsCreate, {
      id: randomUUID(),
      sectionId: randomUUID(),
      texts: { uk: { name: 'Без розділу' } },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(issues(err)).toEqual([
      { path: ['sectionId'], code: 'invalid_value' },
    ]);
  });

  it('saveDescription з неіснуючим base.sectionId → 400 на [base, sectionId]', async () => {
    const { id, version } = await create({ uk: { name: 'Є товар' } });
    const err = await saveDescription(id, version, {
      base: { sectionId: randomUUID() },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(issues(err)).toEqual([
      { path: ['base', 'sectionId'], code: 'invalid_value' },
    ]);
  });
});
