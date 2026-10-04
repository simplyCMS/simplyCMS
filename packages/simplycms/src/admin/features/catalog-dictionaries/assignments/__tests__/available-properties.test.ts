import { describe, expect, it } from 'vitest';
import type { SectionPropertyAssignment } from 'simplycms/schema/types';
import { availableProperties } from '../available-properties';
import { PROPS } from '../../properties/__tests__/render-support';

const [P1, P2, P3] = PROPS as [
  (typeof PROPS)[0],
  (typeof PROPS)[0],
  (typeof PROPS)[0],
];

const assign = (
  p: { id: string },
  appliesTo: 'product' | 'modification',
): SectionPropertyAssignment => ({
  id: crypto.randomUUID(),
  sectionId: 'b0000000-0000-4000-8000-000000000001',
  propertyId: p.id,
  sortOrder: 0,
  createdAt: new Date(),
  appliesTo,
});

describe('availableProperties (Review Focus 3)', () => {
  it('властивість, призначена для товарів, не доступна і для модифікацій', () => {
    expect(
      availableProperties([P1, P2], [assign(P1, 'product')]).map((p) => p.id),
    ).toEqual([P2.id]);
  });

  it('призначена для модифікацій — не доступна і для товарів', () => {
    expect(
      availableProperties([P1, P2, P3], [assign(P3, 'modification')]).map(
        (p) => p.id,
      ),
    ).toEqual([P1.id, P2.id]);
  });

  it('без призначень доступні всі, порядок вхідного списку збережено', () => {
    expect(availableProperties([P3, P1], []).map((p) => p.id)).toEqual([
      P3.id,
      P1.id,
    ]);
  });
});
