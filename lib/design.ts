import { z } from "zod";

export type PrintArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The studio's design coordinate space. Shared by the canvas, the admin
 * preview and (via lib/print) the print file, so they cannot drift. */
export const STAGE_W = 520;
export const STAGE_H = 600;

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Side = "front" | "back";

export type TextElement = {
  id: string;
  kind: "text";
  content: string;
  fontFamily: string;
  fill: string;
  fontSize: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

export type ImageElement = {
  id: string;
  kind: "image";
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

export type DesignElement = TextElement | ImageElement;

export type DesignState = {
  front: DesignElement[];
  back: DesignElement[];
};

export const TEXT_FONTS = ["Arial", "Georgia", "Courier New", "Impact"];
export const TEXT_COLORS = ["#111111", "#ffffff", "#e4572e", "#1b2a4a"];

// One source of truth for what a valid design element is, used by both the
// order API (server) and deserializeDesign (client) so they cannot disagree.
export const textElementSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("text"),
  content: z.string(),
  fontFamily: z.string().min(1),
  fill: z.string().min(1),
  fontSize: z.number().positive(),
  x: z.number(),
  y: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
});

export const imageElementSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("image"),
  url: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
});

export const designElementSchema = z.discriminatedUnion("kind", [
  textElementSchema,
  imageElementSchema,
]);

export function newId(): string {
  return crypto.randomUUID();
}

export function makeTextElement(
  over: Partial<TextElement> & { x: number; y: number },
): TextElement {
  return {
    id: newId(),
    kind: "text",
    content: "Your text",
    fontFamily: TEXT_FONTS[0],
    fill: TEXT_COLORS[0],
    fontSize: 28,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    ...over,
  };
}

export function makeImageElement(
  over: Partial<ImageElement> & { url: string; x: number; y: number },
): ImageElement {
  return {
    id: newId(),
    kind: "image",
    width: 120,
    height: 120,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    ...over,
  };
}

const EPS = 0.5;

/** True when a box sits fully inside the print area. */
export function isBoxInsideArea(box: Box, area: PrintArea): boolean {
  return (
    box.x >= area.x - EPS &&
    box.y >= area.y - EPS &&
    box.x + box.width <= area.x + area.width + EPS &&
    box.y + box.height <= area.y + area.height + EPS
  );
}

/** Approximate on-stage bounds of an element, including its scale. Text width
 * is estimated (the exact glyph width is only known to the renderer). */
export function elementBox(el: DesignElement): Box {
  if (el.kind === "image") {
    return {
      x: el.x,
      y: el.y,
      width: Math.max(1, el.width * Math.abs(el.scaleX)),
      height: Math.max(1, el.height * Math.abs(el.scaleY)),
    };
  }
  return {
    x: el.x,
    y: el.y,
    width: Math.max(1, el.content.length * el.fontSize * 0.6 * Math.abs(el.scaleX)),
    height: Math.max(1, el.fontSize * 1.2 * Math.abs(el.scaleY)),
  };
}

const EMPTY_DESIGN: DesignState = { front: [], back: [] };

function isValidElement(value: unknown): value is DesignElement {
  return designElementSchema.safeParse(value).success;
}

function isValidState(value: unknown): value is DesignState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    Array.isArray(s.front) &&
    Array.isArray(s.back) &&
    s.front.every(isValidElement) &&
    s.back.every(isValidElement)
  );
}

/** Structured JSON for storage with an order (PRD §10). */
export function serializeDesign(state: DesignState): string {
  return JSON.stringify(state);
}

/** Parse stored JSON, returning an empty design rather than throwing on bad data. */
export function deserializeDesign(raw: string | null): DesignState {
  if (!raw) return EMPTY_DESIGN;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return EMPTY_DESIGN;
    return { front: parsed.front, back: parsed.back };
  } catch {
    return EMPTY_DESIGN;
  }
}

/** Relative luminance 0..1 of a hex colour, for choosing a blend mode. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
