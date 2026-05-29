import { describe, it, expect } from "vitest";
import {
  calculateProductAvailability,
  enrichProductsWithAvailability,
} from "../inventory";
import type { ProductAvailabilityInput, StockData } from "../inventory";

const emptyStock: StockData = { modificationStock: {}, productStock: {} };

describe("calculateProductAvailability", () => {
  it("simple product available via inline stock", () => {
    const p: ProductAvailabilityInput = {
      id: "p1",
      stock_status: "in_stock",
      has_modifications: false,
      stock_by_pickup_point: [{ quantity: 3 }],
    };
    expect(calculateProductAvailability(p, emptyStock)).toBe(true);
  });

  it("simple product on_order is available with zero stock", () => {
    const p: ProductAvailabilityInput = {
      id: "p1",
      stock_status: "on_order",
      has_modifications: false,
    };
    expect(calculateProductAvailability(p, emptyStock)).toBe(true);
  });

  it("simple product out_of_stock with zero qty is unavailable", () => {
    const p: ProductAvailabilityInput = {
      id: "p1",
      stock_status: "out_of_stock",
      has_modifications: false,
    };
    expect(calculateProductAvailability(p, emptyStock)).toBe(false);
  });

  it("product with modifications: available if any modification has stock", () => {
    const p: ProductAvailabilityInput = {
      id: "p1",
      stock_status: "out_of_stock",
      has_modifications: true,
      product_modifications: [
        { id: "m1", stock_status: "out_of_stock", is_default: true, sort_order: 0 },
        { id: "m2", stock_status: "in_stock", is_default: false, sort_order: 1 },
      ],
    };
    const stock: StockData = { modificationStock: { m2: 5 }, productStock: {} };
    expect(calculateProductAvailability(p, stock)).toBe(true);
  });
});

describe("enrichProductsWithAvailability", () => {
  it("adds isAvailable flag", () => {
    const products: ProductAvailabilityInput[] = [
      { id: "p1", stock_status: "on_order", has_modifications: false },
    ];
    const res = enrichProductsWithAvailability(products, {});
    expect(res[0].isAvailable).toBe(true);
  });
});
