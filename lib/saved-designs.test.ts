import { beforeEach, describe, it, expect } from "vitest";
import {
  deleteSaved,
  readSaved,
  saveDesign,
  savedForProduct,
  type SavedDesign,
} from "./saved-designs";

function sample(productId: string): Omit<SavedDesign, "id" | "savedAt"> {
  return {
    name: "My design",
    productId,
    productName: "Crew Neck Tee",
    colorHex: "#000000",
    colorName: "Black",
    printMethod: "dtf",
    quantity: 1,
    sizeBreakdown: { M: 1 },
    design: {
      front: [
        {
          id: "el-1",
          kind: "text",
          content: "Hi",
          fontFamily: "Arial",
          fill: "#ffffff",
          fontSize: 20,
          x: 1,
          y: 2,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
      ],
      back: [],
    },
  };
}

beforeEach(() => localStorage.clear());

describe("saved designs", () => {
  it("saves and reads back a design", () => {
    saveDesign(sample("p1"));
    const items = readSaved();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("My design");
    expect(items[0].id).toBeTruthy();
    expect(items[0].savedAt).toBeTruthy();
  });

  it("filters saved designs by product", () => {
    saveDesign(sample("p1"));
    saveDesign(sample("p2"));
    expect(savedForProduct("p1")).toHaveLength(1);
    expect(savedForProduct("p2")).toHaveLength(1);
    expect(savedForProduct("p3")).toHaveLength(0);
  });

  it("deletes a saved design", () => {
    const after = saveDesign(sample("p1"));
    deleteSaved(after[0].id);
    expect(readSaved()).toHaveLength(0);
  });

  it("keeps the newest first", () => {
    saveDesign({ ...sample("p1"), name: "first" });
    saveDesign({ ...sample("p1"), name: "second" });
    expect(readSaved()[0].name).toBe("second");
  });

  it("survives corrupt stored data", () => {
    localStorage.setItem("sg-saved-designs", "{not json");
    expect(readSaved()).toEqual([]);
  });
});
