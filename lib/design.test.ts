import { describe, it, expect } from "vitest";
import {
  clampBoxTopLeft,
  deserializeDesign,
  isBoxInsideArea,
  luminance,
  makeTextElement,
  serializeDesign,
  type DesignState,
  type PrintArea,
} from "./design";

const area: PrintArea = { x: 100, y: 100, width: 300, height: 400 };

describe("isBoxInsideArea", () => {
  it("accepts a box fully inside", () => {
    expect(isBoxInsideArea({ x: 110, y: 120, width: 100, height: 100 }, area)).toBe(
      true,
    );
  });

  it("rejects a box that pokes out on the right", () => {
    expect(
      isBoxInsideArea({ x: 350, y: 120, width: 100, height: 100 }, area),
    ).toBe(false);
  });

  it("rejects a box above the area", () => {
    expect(isBoxInsideArea({ x: 110, y: 40, width: 50, height: 50 }, area)).toBe(
      false,
    );
  });
});

describe("clampBoxTopLeft", () => {
  it("leaves an inside box where it is", () => {
    expect(clampBoxTopLeft({ x: 150, y: 150, width: 50, height: 50 }, area)).toEqual(
      { x: 150, y: 150 },
    );
  });

  it("pulls a box back from the right and bottom edges", () => {
    expect(
      clampBoxTopLeft({ x: 380, y: 460, width: 100, height: 100 }, area),
    ).toEqual({ x: 300, y: 400 });
  });

  it("pulls a box back from the top-left corner", () => {
    expect(clampBoxTopLeft({ x: 10, y: 10, width: 40, height: 40 }, area)).toEqual({
      x: 100,
      y: 100,
    });
  });
});

describe("makeTextElement", () => {
  it("produces a selectable text element with defaults", () => {
    const el = makeTextElement({ x: 10, y: 20 });
    expect(el.kind).toBe("text");
    expect(el.content).toBe("Your text");
    expect(el.x).toBe(10);
    expect(el.fontSize).toBeGreaterThan(0);
    expect(el.id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe("serializeDesign / deserializeDesign", () => {
  const state: DesignState = {
    front: [makeTextElement({ x: 5, y: 5, content: "Hello" })],
    back: [],
  };

  it("round-trips a design without changing it", () => {
    expect(deserializeDesign(serializeDesign(state))).toEqual(state);
  });

  it("returns an empty design for null input", () => {
    expect(deserializeDesign(null)).toEqual({ front: [], back: [] });
  });

  it("returns an empty design for malformed JSON", () => {
    expect(deserializeDesign("{not json")).toEqual({ front: [], back: [] });
  });

  it("rejects a design containing an invalid element", () => {
    const bad = JSON.stringify({
      front: [{ kind: "text", x: 1 }],
      back: [],
    });
    expect(deserializeDesign(bad)).toEqual({ front: [], back: [] });
  });
});

describe("luminance", () => {
  it("reads white as light and black as dark", () => {
    expect(luminance("#ffffff")).toBeGreaterThan(0.5);
    expect(luminance("#000000")).toBeLessThan(0.5);
  });
});
