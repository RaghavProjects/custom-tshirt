import { describe, it, expect } from "vitest";
import { orderSchema } from "./orders";

const base = {
  productId: "1f0d4e55-223d-4574-b62c-df3207cd1e89",
  colorHex: "#000000",
  quantity: 2,
  sizeBreakdown: { M: 1, L: 1 },
  printMethod: "dtf" as const,
  customer: { name: "Asha", phone: "9999999999", email: "asha@example.com" },
  shipping: { line1: "1 MG Road", city: "Jaipur", pincode: "302001" },
  design: {
    shirtColor: "#000000",
    front: [
      {
        id: "el-1",
        kind: "text" as const,
        content: "Hello",
        fontFamily: "Arial",
        fill: "#ffffff",
        fontSize: 24,
        x: 10,
        y: 10,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
    ],
    back: [],
  },
};

describe("orderSchema", () => {
  it("accepts a complete order", () => {
    expect(orderSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a missing customer name and names the field", () => {
    const bad = { ...base, customer: { ...base.customer, name: "" } };
    const result = orderSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(
      result.success === false &&
        result.error.issues.some((i) => i.path.join(".") === "customer.name"),
    ).toBe(true);
  });

  it("rejects an order with no design element", () => {
    const bad = {
      ...base,
      design: { ...base.design, front: [], back: [] },
    };
    const result = orderSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(
      result.success === false &&
        result.error.issues.some((i) => i.path.join(".") === "design"),
    ).toBe(true);
  });

  it("rejects a size breakdown that does not sum to the quantity", () => {
    const bad = { ...base, sizeBreakdown: { M: 1 } };
    const result = orderSchema.safeParse(bad);
    expect(result.success).toBe(false);
    expect(
      result.success === false &&
        result.error.issues.some((i) => i.path.join(".") === "sizeBreakdown"),
    ).toBe(true);
  });

  it("rejects an all-zero size breakdown", () => {
    const bad = { ...base, sizeBreakdown: { M: 0, L: 0 }, quantity: 0 };
    expect(orderSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown print method", () => {
    const bad = { ...base, printMethod: "screen" };
    expect(orderSchema.safeParse(bad).success).toBe(false);
  });
});
