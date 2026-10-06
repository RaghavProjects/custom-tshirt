import { describe, it, expect } from "vitest";
import { validateArtwork } from "./artwork";
import type { ArtworkRules } from "./settings";

const rules: ArtworkRules = {
  acceptedTypes: ["image/png", "image/jpeg"],
  maxFileSizeBytes: 5 * 1024 * 1024,
  isPlaceholder: false,
};

describe("validateArtwork", () => {
  it("accepts a PNG within the size limit", () => {
    expect(validateArtwork({ type: "image/png", size: 1000 }, rules)).toEqual({
      ok: true,
    });
  });

  it("rejects an unsupported type", () => {
    const result = validateArtwork({ type: "text/plain", size: 10 }, rules);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("Unsupported");
  });

  it("rejects a file over the limit", () => {
    const result = validateArtwork(
      { type: "image/jpeg", size: 6 * 1024 * 1024 },
      rules,
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("larger");
  });

  it("rejects an empty file", () => {
    const result = validateArtwork({ type: "image/png", size: 0 }, rules);
    expect(result.ok).toBe(false);
  });
});
