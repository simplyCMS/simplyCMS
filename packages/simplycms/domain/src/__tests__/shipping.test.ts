import { describe, it, expect } from "vitest";
import {
  calculateShippingCost,
  calculateShipping,
  formatShippingCost,
  findShippingZoneIn,
} from "../shipping";
import type {
  ShippingRate,
  ShippingCalculationContext,
} from "../shipping";

function makeRate(over: Partial<ShippingRate>): ShippingRate {
  return {
    id: "r1",
    method_id: "m1",
    zone_id: "z1",
    name: "Rate",
    calculation_type: "flat",
    base_cost: 50,
    per_kg_cost: null,
    min_weight: null,
    free_from_amount: null,
    min_order_amount: null,
    max_order_amount: null,
    estimated_days: "1-2",
    is_active: true,
    sort_order: 0,
    config: {},
    created_at: "",
    ...over,
  };
}

function makeCtx(over?: Partial<ShippingCalculationContext>): ShippingCalculationContext {
  return {
    method: {
      id: "m1",
      code: "m",
      name: "M",
      description: null,
      type: "system",
      plugin_name: null,
      is_active: true,
      sort_order: 0,
      config: {},
      icon: null,
      created_at: "",
      updated_at: "",
    },
    zone: null,
    cart: { items: [], subtotal: 1000 },
    ...over,
  };
}

describe("calculateShippingCost", () => {
  it("flat returns base cost", () => {
    expect(calculateShippingCost(makeRate({}), makeCtx())).toBe(50);
  });

  it("free_from returns 0 above threshold", () => {
    const rate = makeRate({ calculation_type: "free_from", free_from_amount: 500 });
    expect(calculateShippingCost(rate, makeCtx({ cart: { items: [], subtotal: 600 } }))).toBe(0);
  });

  it("weight adds per-kg cost", () => {
    const rate = makeRate({ calculation_type: "weight", per_kg_cost: 10 });
    const ctx = makeCtx({ cart: { items: [], subtotal: 100, totalWeight: 3 } });
    expect(calculateShippingCost(rate, ctx)).toBe(50 + 30);
  });

  it("order_total returns percentage", () => {
    const rate = makeRate({ calculation_type: "order_total", base_cost: 10 });
    expect(calculateShippingCost(rate, makeCtx({ cart: { items: [], subtotal: 1000 } }))).toBe(100);
  });

  it("returns -1 below min_order_amount", () => {
    const rate = makeRate({ min_order_amount: 2000 });
    expect(calculateShippingCost(rate, makeCtx())).toBe(-1);
  });
});

describe("calculateShipping", () => {
  it("returns null for plugin methods", async () => {
    const ctx = makeCtx({ method: { ...makeCtx().method, type: "plugin" } });
    expect(await calculateShipping(ctx, [makeRate({})])).toBeNull();
  });

  it("picks first applicable active rate", async () => {
    const res = await calculateShipping(makeCtx(), [makeRate({ id: "r1" })]);
    expect(res?.rateId).toBe("r1");
    expect(res?.cost).toBe(50);
  });
});

describe("formatShippingCost", () => {
  it("formats edge cases", () => {
    expect(formatShippingCost(null)).toBe("За тарифами");
    expect(formatShippingCost(-1)).toBe("За тарифами");
    expect(formatShippingCost(0)).toBe("Безкоштовно");
    expect(formatShippingCost(100)).toContain("100");
  });
});

describe("findShippingZoneIn", () => {
  const zones = [
    { id: "kyiv", cities: ["Київ"], regions: [], is_default: false },
    { id: "default", cities: [], regions: [], is_default: true },
  ];
  it("matches by city (normalized)", () => {
    expect(findShippingZoneIn(zones, " київ ")?.id).toBe("kyiv");
  });
  it("falls back to default zone", () => {
    expect(findShippingZoneIn(zones, "Львів")?.id).toBe("default");
  });
});
