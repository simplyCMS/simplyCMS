// Типи рушія знижок, що живуть у домені, а не в контракті: реєстр умов
// і плоскі правила, з яких будується ліс (Е6в-4, Е6в-8).

import type {
  Discount,
  DiscountContext,
  DiscountGroup,
  Json,
} from 'simplycms/contracts';

/**
 * Визначення типу умови (Е6в-4) — без Zod: `contracts`/`domain` його не
 * імпортують (Е6а-19), а адмінський Zod кличе цей самий `parse` у `refine`,
 * тож запис і рушій ділять одне правило валідності.
 *
 * `parse` повертає `null` на будь-яке значення поза контрактом — рушій тоді
 * вважає умову НЕ виконаною (fail-closed), а не пропускає її.
 */
export interface DiscountConditionDefinition<C> {
  type: string;
  parse(operator: string, value: Json): C | null;
  evaluate(config: C, ctx: DiscountContext): boolean;
}

/** Рядок групи без гілок — так група лежить у БД (`parent_group_id`). */
export type DiscountGroupRow = Omit<DiscountGroup, 'discounts' | 'children'> & {
  parent_group_id: string | null;
};

/**
 * ВСІ групи й ВСІ знижки магазину одним знімком (Е6в-8). Дерево з них
 * будує `buildDiscountForest` під конкретний тип ціни.
 */
export type DiscountRules = {
  groups: DiscountGroupRow[];
  discounts: Discount[];
  /** Рядки, виключені fail-closed на межі розбору (Е6в-25). */
  invalid: InvalidDiscountRow[];
};

/**
 * Пошкоджений рядок правил: у ліс не потрапляє, лише у діагностику ціни
 * (`discount_invalid`). Назви — сирі, бо рядок не пройшов валідацію.
 */
export type InvalidDiscountRow = {
  id: string;
  name: string;
  groupName: string | null;
  kind: 'group' | 'discount';
};
