import { describe, it, expect } from "vitest";
import { buildStudioUrl } from "./studio-url";

describe("buildStudioUrl", () => {
  it("encodes product, colour and size", () => {
    expect(buildStudioUrl("abc", "#ffffff", "XL")).toBe(
      "/studio?product=abc&color=%23ffffff&size=XL",
    );
  });

  it("encodes characters that would break the URL", () => {
    expect(buildStudioUrl("a b", "#000000", "XXL")).toContain("product=a+b");
  });
});
