import { describe, it, expect } from "vitest";
import {
  HALF_PIZZA_EXTRA,
  halfPizzaHalfPrice,
  halfPizzaTotalPrice,
} from "@/lib/utils";

describe("half-and-half pizza pricing", () => {
  it("charges HALF_PIZZA_EXTRA on top of half the full price", () => {
    expect(HALF_PIZZA_EXTRA).toBe(1000);
    // Regular 10000 -> half 6000
    expect(halfPizzaHalfPrice(10000)).toBe(6000);
    // Special 12000 -> half 7000
    expect(halfPizzaHalfPrice(12000)).toBe(7000);
  });

  it("sums both halves for the total", () => {
    expect(halfPizzaTotalPrice(10000, 12000)).toBe(13000);
    expect(halfPizzaTotalPrice(10000, 10000)).toBe(12000);
  });

  it("rounds to avoid fractional pesos", () => {
    expect(halfPizzaHalfPrice(9999)).toBe(6000);
    expect(Number.isInteger(halfPizzaHalfPrice(9999))).toBe(true);
  });

  it("handles zero / null-ish prices", () => {
    expect(halfPizzaHalfPrice(0)).toBe(1000);
  });
});
