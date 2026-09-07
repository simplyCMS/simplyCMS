// Discount Engine - Pure computation logic for discount tree evaluation

export type DiscountType = 'percent' | 'fixed_amount' | 'fixed_price';
export type GroupOperator = 'and' | 'or' | 'not' | 'min' | 'max';
export type TargetType = 'product' | 'modification' | 'section' | 'all';

export interface DiscountTarget {
  id: string;
  target_type: TargetType;
  target_id: string | null;
}

export interface DiscountCondition {
  id: string;
  condition_type: string;
  operator: string;
  value: any;
}

export interface Discount {
  id: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  targets: DiscountTarget[];
  conditions: DiscountCondition[];
}

export interface DiscountGroup {
  id: string;
  name: string;
  description: string | null;
  operator: GroupOperator;
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  discounts: Discount[];
  children: DiscountGroup[];
}

export interface DiscountContext {
  userId?: string | null;
  userCategoryId?: string | null;
  quantity: number;
  cartTotal: number;
  productId: string;
  modificationId?: string | null;
  sectionId?: string | null;
  isLoggedIn: boolean;
  now?: Date;
}

export interface AppliedDiscount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  calculatedAmount: number;
  groupName: string;
}

export interface RejectedDiscount {
  id: string;
  name: string;
  reason: string;
  groupName: string;
}

export interface DiscountResult {
  finalPrice: number;
  totalDiscount: number;
  appliedDiscounts: AppliedDiscount[];
  rejectedDiscounts: RejectedDiscount[];
}

// --- Date check ---
function isWithinDateRange(startsAt: string | null, endsAt: string | null, now: Date): boolean {
  if (startsAt && new Date(startsAt) > now) return false;
  if (endsAt && new Date(endsAt) < now) return false;
  return true;
}

// --- Target matching ---
function matchesTarget(targets: DiscountTarget[], ctx: DiscountContext): boolean {
  if (!targets.length) return true; // no targets = applies to all
  return targets.some((t) => {
    if (t.target_type === 'all') return true;
    if (t.target_type === 'product') return t.target_id === ctx.productId;
    if (t.target_type === 'modification') return t.target_id === ctx.modificationId;
    if (t.target_type === 'section') return t.target_id === ctx.sectionId;
    return false;
  });
}

// --- Condition evaluation ---
function evaluateCondition(cond: DiscountCondition, ctx: DiscountContext): { met: boolean; reason: string } {
  const { condition_type, operator, value } = cond;

  switch (condition_type) {
    case 'user_category': {
      if (!ctx.userCategoryId) return { met: false, reason: 'Користувач без категорії' };
      const ids: string[] = Array.isArray(value) ? value : [value];
      const met = operator === 'in' ? ids.includes(ctx.userCategoryId) : !ids.includes(ctx.userCategoryId);
      return { met, reason: met ? '' : `Категорія користувача не входить у список` };
    }
    case 'min_quantity': {
      const met = compareNumeric(ctx.quantity, operator, Number(value));
      return { met, reason: met ? '' : `Кількість ${ctx.quantity} не відповідає умові ${operator} ${value}` };
    }
    case 'min_order_amount': {
      const met = compareNumeric(ctx.cartTotal, operator, Number(value));
      return { met, reason: met ? '' : `Сума кошика ${ctx.cartTotal} не відповідає умові ${operator} ${value}` };
    }
    case 'user_logged_in': {
      const expected = value === true || value === 'true';
      const met = ctx.isLoggedIn === expected;
      return { met, reason: met ? '' : expected ? 'Потрібна авторизація' : 'Тільки для гостей' };
    }
    default:
      return { met: false, reason: `Невідомий тип умови: ${condition_type}` };
  }
}

function compareNumeric(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case '>=': return actual >= expected;
    case '>': return actual > expected;
    case '<=': return actual <= expected;
    case '<': return actual < expected;
    case '=': return actual === expected;
    default: return false;
  }
}

// --- Single discount calculation ---
function calculateDiscountAmount(basePrice: number, discount: Discount): number {
  switch (discount.discount_type) {
    case 'percent':
      return basePrice * (discount.discount_value / 100);
    case 'fixed_amount':
      return Math.min(discount.discount_value, basePrice);
    case 'fixed_price':
      return Math.max(0, basePrice - discount.discount_value);
    default:
      return 0;
  }
}

// --- Evaluate a single discount against context ---
interface EvalResult {
  applicable: boolean;
  amount: number;
  discount: Discount;
  rejectionReasons: string[];
}

function evaluateDiscount(discount: Discount, basePrice: number, ctx: DiscountContext, now: Date): EvalResult {
  const reasons: string[] = [];

  if (!discount.is_active) {
    return { applicable: false, amount: 0, discount, rejectionReasons: ['Скидка неактивна'] };
  }
  if (!isWithinDateRange(discount.starts_at, discount.ends_at, now)) {
    return { applicable: false, amount: 0, discount, rejectionReasons: ['Скидка поза терміном дії'] };
  }
  if (!matchesTarget(discount.targets, ctx)) {
    return { applicable: false, amount: 0, discount, rejectionReasons: ['Товар не входить у цілі скидки'] };
  }

  // Evaluate all conditions
  for (const cond of discount.conditions) {
    const { met, reason } = evaluateCondition(cond, ctx);
    if (!met) reasons.push(reason);
  }

  if (reasons.length > 0) {
    return { applicable: false, amount: 0, discount, rejectionReasons: reasons };
  }

  const amount = calculateDiscountAmount(basePrice, discount);
  return { applicable: true, amount, discount, rejectionReasons: [] };
}

// --- Group evaluation (recursive) ---
interface GroupResult {
  totalAmount: number;
  applied: AppliedDiscount[];
  rejected: RejectedDiscount[];
}

function evaluateGroup(group: DiscountGroup, basePrice: number, ctx: DiscountContext, now: Date): GroupResult {
  const applied: AppliedDiscount[] = [];
  const rejected: RejectedDiscount[] = [];

  if (!group.is_active) return { totalAmount: 0, applied, rejected };
  if (!isWithinDateRange(group.starts_at, group.ends_at, now)) return { totalAmount: 0, applied, rejected };

  // Evaluate all direct discounts in this group (sorted by priority)
  const sortedDiscounts = [...group.discounts].sort((a, b) => a.priority - b.priority);
  const evalResults: EvalResult[] = sortedDiscounts.map((d) => evaluateDiscount(d, basePrice, ctx, now));

  // Evaluate child groups recursively
  const sortedChildren = [...group.children].sort((a, b) => a.priority - b.priority);
  const childResults: GroupResult[] = sortedChildren.map((child) => evaluateGroup(child, basePrice, ctx, now));

  // Collect all amounts (from both discounts and child groups)
  const allAmounts: { amount: number; source: AppliedDiscount | null }[] = [];

  for (const res of evalResults) {
    if (res.applicable) {
      const entry: AppliedDiscount = {
        id: res.discount.id,
        name: res.discount.name,
        type: res.discount.discount_type,
        value: res.discount.discount_value,
        calculatedAmount: res.amount,
        groupName: group.name,
      };
      allAmounts.push({ amount: res.amount, source: entry });
    } else {
      rejected.push({
        id: res.discount.id,
        name: res.discount.name,
        reason: res.rejectionReasons.join('; '),
        groupName: group.name,
      });
    }
  }

  for (const cr of childResults) {
    applied.push(...cr.applied);
    rejected.push(...cr.rejected);
    if (cr.totalAmount > 0) {
      allAmounts.push({ amount: cr.totalAmount, source: null });
    }
  }

  // Apply group operator
  let totalAmount = 0;

  switch (group.operator) {
    case 'and': {
      // Sum all applicable
      for (const a of allAmounts) {
        totalAmount += a.amount;
        if (a.source) applied.push(a.source);
      }
      break;
    }
    case 'or': {
      // First applicable by priority
      const first = allAmounts[0];
      if (first) {
        totalAmount = first.amount;
        if (first.source) applied.push(first.source);
        // Reject the rest
        for (let i = 1; i < allAmounts.length; i++) {
          const s = allAmounts[i].source;
          if (s) {
            rejected.push({ id: s.id, name: s.name, reason: 'Оператор OR: обрано скидку з вищим пріоритетом', groupName: group.name });
          }
        }
      }
      break;
    }
    case 'not': {
      // If any discount is applicable, NONE apply (inversion)
      if (allAmounts.length > 0) {
        for (const a of allAmounts) {
          if (a.source) {
            rejected.push({ id: a.source.id, name: a.source.name, reason: 'Оператор NOT: умови виконані, скидка інвертована', groupName: group.name });
          }
        }
        totalAmount = 0;
      }
      break;
    }
    case 'min': {
      // Pick minimum discount
      if (allAmounts.length > 0) {
        let minIdx = 0;
        for (let i = 1; i < allAmounts.length; i++) {
          if (allAmounts[i].amount < allAmounts[minIdx].amount) minIdx = i;
        }
        totalAmount = allAmounts[minIdx].amount;
        for (let i = 0; i < allAmounts.length; i++) {
          const s = allAmounts[i].source;
          if (i === minIdx) {
            if (s) applied.push(s);
          } else if (s) {
            rejected.push({ id: s.id, name: s.name, reason: 'Оператор MIN: обрано меншу скидку', groupName: group.name });
          }
        }
      }
      break;
    }
    case 'max': {
      // Pick maximum discount
      if (allAmounts.length > 0) {
        let maxIdx = 0;
        for (let i = 1; i < allAmounts.length; i++) {
          if (allAmounts[i].amount > allAmounts[maxIdx].amount) maxIdx = i;
        }
        totalAmount = allAmounts[maxIdx].amount;
        for (let i = 0; i < allAmounts.length; i++) {
          const s = allAmounts[i].source;
          if (i === maxIdx) {
            if (s) applied.push(s);
          } else if (s) {
            rejected.push({ id: s.id, name: s.name, reason: 'Оператор MAX: обрано більшу скидку', groupName: group.name });
          }
        }
      }
      break;
    }
  }

  // Handle fixed_price conflict in AND groups: fixed_price wins
  if (group.operator === 'and') {
    const fixedPriceDiscount = applied.find((a) => a.type === 'fixed_price');
    if (fixedPriceDiscount) {
      // fixed_price overrides everything else
      const others = applied.filter((a) => a.id !== fixedPriceDiscount.id);
      for (const o of others) {
        rejected.push({ id: o.id, name: o.name, reason: 'Фіксована ціна має пріоритет в групі AND', groupName: group.name });
      }
      return {
        totalAmount: fixedPriceDiscount.calculatedAmount,
        applied: [fixedPriceDiscount],
        rejected,
      };
    }
  }

  return { totalAmount, applied, rejected };
}

// --- Main export ---
export function resolveDiscount(
  basePrice: number,
  groups: DiscountGroup[],
  context: DiscountContext
): DiscountResult {
  const now = context.now || new Date();
  let totalDiscount = 0;
  const allApplied: AppliedDiscount[] = [];
  const allRejected: RejectedDiscount[] = [];

  // Evaluate all root-level groups, sorted by priority
  const sorted = [...groups].sort((a, b) => a.priority - b.priority);

  for (const group of sorted) {
    const result = evaluateGroup(group, basePrice, context, now);
    totalDiscount += result.totalAmount;
    allApplied.push(...result.applied);
    allRejected.push(...result.rejected);
  }

  // Ensure discount doesn't exceed base price
  totalDiscount = Math.min(totalDiscount, basePrice);

  return {
    finalPrice: Math.max(0, basePrice - totalDiscount),
    totalDiscount,
    appliedDiscounts: allApplied,
    rejectedDiscounts: allRejected,
  };
}
