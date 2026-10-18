// М1 Task 5 (І22 на реальних генераторах): `createPathsForEntity` і
// `createTokensForEntity` на однакових base і однаковій картині зайнятих
// дають однакові slug-и, включно з `-2`/`-3`. `domain/slugs/__tests__/parity.test.ts`
// доводить лише тотожність бареля; тут — що обидва реєстри справді кличуть її
// однаково (окрема логіка суфікса в токенах розвела б їх).
import { describe, expect, it } from 'vitest';
import {
  createPathsForEntity,
  createTokensForEntity,
} from 'simplycms/addressing';
import { useAddressingDb } from './fixtures/addressing-db';
import { slugTokenRowSql, urlPathRowSql } from './fixtures/product-graph';

describe('паритет адрес і токенів на реальних генераторах (І22)', () => {
  const db = useAddressingDb('simplycms_addressing_parity');

  it('однакова картина зайнятих → однакові slug-и, включно з -2/-3 і історією', async () => {
    // Картина зайнятих (у мові uk): panel — поточний, panel-2 — історичний.
    // Поточні — від фікстури (товару й модифікації без них не буває, І16).
    const owner = await db.product('panel');
    const ownerMod = await db.modification(owner, 'panel');
    const insertPath = (path: string, current: boolean) =>
      db.w(
        urlPathRowSql({
          locale: 'uk',
          path,
          productId: owner,
          isCurrent: current,
        }),
      );
    const insertToken = (slug: string, current: boolean) =>
      db.w(
        slugTokenRowSql({
          locale: 'uk',
          scopeId: owner,
          slug,
          modificationId: ownerMod,
          isCurrent: current,
        }),
      );
    await insertPath('panel-2', false);
    await insertToken('panel-2', false);

    const viaPaths: string[] = [];
    const viaTokens: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      // Нова сутність і її адреса/токен — одна транзакція, як у команді агрегата.
      viaPaths.push(
        (
          await db.fresh((d, id) =>
            createPathsForEntity(d, { kind: 'product', id }, 'panel'),
          )
        ).get('uk')!,
      );
      // Токени живуть в області товару: усі нові модифікації — одного товару,
      // тож простір імен той самий, що в адрес (одна мова, одна область).
      viaTokens.push(
        (
          await db.freshModification(owner, (d, id) =>
            createTokensForEntity(
              d,
              { kind: 'modification', id, scopeId: owner },
              'panel',
            ),
          )
        ).get('uk')!,
      );
    }
    expect(viaPaths).toEqual(['panel-3', 'panel-4', 'panel-5', 'panel-6']);
    expect(viaTokens).toEqual(viaPaths);
  });
});
