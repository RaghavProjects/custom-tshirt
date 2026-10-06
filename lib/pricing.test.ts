import { describe, it, expect } from "vitest";
import { orderTotal, unitPriceFor, type PriceBreak } from "./pricing";

const breaks: PriceBreak[] = [
  { minQty: 1, unitPrice: 350 },
  { minQty: 12, unitPrice: 300 },
  { minQty: 50, unitPrice: 250 },
];

describe("unitPriceFor", () => {
  it("uses the base price when there are no tiers", () => {
    expect(unitPriceFor(400, 3, [])).toBe(400);
  });

  it("just below a break uses the lower tier", () => {
    expect(unitPriceFor(400, 11, breaks)).toBe(350);
  });

  it("exactly at a break uses the new tier", () => {
    expect(unitPriceFor(400, 12, breaks)).toBe(300);
  });

  it("just above a break keeps the new tier", () => {
    expect(unitPriceFor(400, 13, breaks)).toBe(300);
  });

  it("the highest reached break wins", () => {
    expect(unitPriceFor(400, 60, breaks)).toBe(250);
  });

  it("returns null when the owner has set no price", () => {
    expect(unitPriceFor(null, 5, [])).toBeNull();
  });

  it("returns null for a non-positive quantity", () => {
    expect(unitPriceFor(400, 0, breaks)).toBeNull();
  });
});

describe("orderTotal", () => {
  it("multiplies and rounds to two decimals", () => {
    expect(orderTotal(333.333, 3)).toBe(1000);
  });

  it("is null when the unit price is unknown", () => {
    expect(orderTotal(null, 3)).toBeNull();
  });
});
