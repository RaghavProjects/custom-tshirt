import { describe, it, expect } from "vitest";
import { adminSettingsSchema } from "./admin-settings";

const base = {
  products: [
    { id: "1f0d4e55-223d-4574-b62c-df3207cd1e89", basePrice: 350 },
    { id: "df887153-ed19-4d40-b1c5-e750f679420b", basePrice: null },
  ],
  bulkPriceBreaks: [
    { minQty: 1, unitPrice: 350 },
    { minQty: 12, unitPrice: 300 },
  ],
  artwork: {
    acceptedTypes: ["image/png", "image/jpeg"],
    maxFileSizeMb: 10,
    minResolutionDpi: 150,
  },
  printArea: { x: 110, y: 100, width: 300, height: 380 },
  shippingFlat: 50,
};

describe("adminSettingsSchema", () => {
  it("accepts a complete settings payload, including a null price", () => {
    expect(adminSettingsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a negative price", () => {
    const bad = {
      ...base,
      products: [{ ...base.products[0], basePrice: -1 }],
    };
    expect(adminSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty accepted-types list", () => {
    const bad = { ...base, artwork: { ...base.artwork, acceptedTypes: [] } };
    expect(adminSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a zero-width print area", () => {
    const bad = { ...base, printArea: { ...base.printArea, width: 0 } };
    expect(adminSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-positive tier quantity", () => {
    const bad = { ...base, bulkPriceBreaks: [{ minQty: 0, unitPrice: 100 }] };
    expect(adminSettingsSchema.safeParse(bad).success).toBe(false);
  });
});
