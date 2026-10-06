import { describe, it, expect } from "vitest";
import { canTransition, nextStates } from "./order-status";

describe("order status transitions", () => {
  it("paid can move into production", () => {
    expect(canTransition("paid", "in_production")).toBe(true);
  });

  it("nothing can skip ahead: paid cannot jump to shipped", () => {
    expect(canTransition("paid", "shipped")).toBe(false);
  });

  it("an unpaid order cannot start production", () => {
    expect(canTransition("pending_payment", "in_production")).toBe(false);
    expect(nextStates("pending_payment")).toEqual([]);
  });

  it("the printing chain moves one step at a time", () => {
    expect(canTransition("in_production", "printed")).toBe(true);
    expect(canTransition("printed", "shipped")).toBe(true);
    expect(canTransition("in_production", "shipped")).toBe(false);
  });

  it("shipped is terminal", () => {
    expect(nextStates("shipped")).toEqual([]);
  });

  it("a status cannot move backwards", () => {
    expect(canTransition("printed", "in_production")).toBe(false);
    expect(canTransition("shipped", "printed")).toBe(false);
  });
});
