// М1 Task 5 (І22 на реальних генераторах): `createPathsForEntity` і
// `createTokensForEntity` на однакових base і однаковій картині зайнятих
// дають однакові slug-и, включно з `-2`/`-3`. `domain/slugs/__tests__/parity.test.ts`
// доводить лише тотожність бареля; тут — що обидва реєстри справді кличуть її
// однаково (окрема логіка суфікса в токенах розвела б їх).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createPathsForEntity,
  createTokensForEntity,
} from 'simplycms/addressing';
import { useAddressingDb } from './fixtures/addressing-db';

describe('паритет адрес і токенів на реальних генераторах (І22)', () => {
  const db = useAddressingDb('simplycms_addressing_parity');
  const { q, admin } = db;

  it('однакова картина зайнятих → однакові slug-и, включно з -2/-3 і історією', async () => {
    // Картина зайнятих (у мові uk): panel — поточний, panel-2 — історичний.
    const owner = await db.product();
    const ownerMod = await db.modification(owner);
    const insertPath = (path: string, current: boolean) =>
      q(
        `insert into public.url_paths (id, locale, path, product_id, is_current)
         values ($1,'uk',$2,$3,$4)`,
        [randomUUID(), path, owner, current],
      );
    const insertToken = (slug: string, current: boolean) =>
      q(
        `insert into public.slug_tokens (id, locale, scope_id, slug, modification_id, is_current)
         values ($1,'uk',$2,$3,$4,$5)`,
        [randomUUID(), owner, slug, ownerMod, current],
      );
    await insertPath('panel', true);
    await insertPath('panel-2', false);
    await insertToken('panel', true);
    await insertToken('panel-2', false);

    const viaPaths: string[] = [];
    const viaTokens: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const p = await db.product();
      viaPaths.push(
        (
          await admin((d) =>
            createPathsForEntity(d, { kind: 'product', id: p }, 'panel', [
              'uk',
            ]),
          )
        ).get('uk')!,
      );
      // Токени живуть в області товару: усі нові модифікації — одного товару,
      // тож простір імен той самий, що в адрес (одна мова, одна область).
      const id = await db.modification(owner);
      viaTokens.push(
        (
          await admin((d) =>
            createTokensForEntity(
              d,
              { kind: 'modification', id, scopeId: owner },
              'panel',
              ['uk'],
            ),
          )
        ).get('uk')!,
      );
    }
    expect(viaPaths).toEqual(['panel-3', 'panel-4', 'panel-5', 'panel-6']);
    expect(viaTokens).toEqual(viaPaths);
  });
});
