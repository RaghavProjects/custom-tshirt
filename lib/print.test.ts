import { describe, it, expect } from "vitest";
import { makeTextElement, type PrintArea } from "./design";
import {
  compositePosition,
  computeOutputSize,
  designToSvg,
  escapeXml,
  textLayerSvg,
} from "./print";

const area: PrintArea = { x: 110, y: 100, width: 300, height: 380 };

describe("computeOutputSize", () => {
  it("scales stage units to the target DPI", () => {
    expect(computeOutputSize(area, 300)).toEqual({
      width: Math.round(300 * (300 / 72)),
      height: Math.round(380 * (300 / 72)),
    });
  });
});

describe("escapeXml", () => {
  it("escapes characters that would break the SVG", () => {
    expect(escapeXml(`<a & "b" 'c'>`)).toBe(
      "&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;",
    );
  });
});

describe("designToSvg", () => {
  it("positions a text element relative to the print area and escapes it", () => {
    const el = makeTextElement({
      x: 110,
      y: 100,
      content: "A & B",
      fontFamily: "Arial",
      fill: "#111111",
      fontSize: 24,
    });
    const svg = designToSvg({ printArea: area, elements: [el] });
    expect(svg).toContain("translate(0 0)");
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain('viewBox="0 0 300 380"');
  });

  it("carries rotation and scale through as a transform", () => {
    const el = makeTextElement({ x: 150, y: 120, rotation: 15 });
    el.scaleX = 2;
    el.scaleY = 0.5;
    const svg = designToSvg({ printArea: area, elements: [el] });
    expect(svg).toContain("rotate(15)");
    expect(svg).toContain("scale(2 0.5)");
  });

  it("embeds an image element with its size", () => {
    const svg = designToSvg({
      printArea: area,
      elements: [
        {
          id: "img-1",
          kind: "image",
          url: "data:image/png;base64,AAAA",
          x: 130,
          y: 140,
          width: 80,
          height: 60,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
      ],
    });
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
    expect(svg).toContain('width="80" height="60"');
  });
});

describe("textLayerSvg", () => {
  it("keeps text and drops images (the reliable rasterisable layer)", () => {
    const svg = textLayerSvg({
      printArea: area,
      elements: [
        makeTextElement({ x: 120, y: 130, content: "Keep me" }),
        {
          id: "img-1",
          kind: "image",
          url: "data:image/png;base64,AAAA",
          x: 130,
          y: 140,
          width: 80,
          height: 60,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
      ],
    });
    expect(svg).toContain("Keep me");
    expect(svg).not.toContain("<image");
  });
});

describe("compositePosition", () => {
  const el = {
    id: "img-1",
    kind: "image" as const,
    url: "x",
    x: 210,
    y: 200,
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };

  it("with no rotation, sits at the element's offset in the print area", () => {
    const dpi = 72; // 1:1 so the numbers are readable
    const { left, top } = compositePosition({
      el,
      printArea: area,
      rotatedWidth: 100,
      rotatedHeight: 100,
      dpi,
    });
    expect(left).toBe(100); // 210 - 110
    expect(top).toBe(100); // 200 - 100
  });

  it("rotating changes the placement to match a top-left origin", () => {
    const dpi = 72;
    const straight = compositePosition({
      el,
      printArea: area,
      rotatedWidth: 100,
      rotatedHeight: 100,
      dpi,
    });
    const rotated = compositePosition({
      el: { ...el, rotation: 45 },
      printArea: area,
      rotatedWidth: 141,
      rotatedHeight: 141,
      dpi,
    });
    expect(rotated).not.toEqual(straight);
  });
});
