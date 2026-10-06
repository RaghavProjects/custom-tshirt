export type PrintArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

/** Clamp a box's top-left so the box stays inside the area. */
export function clampBoxTopLeft(
  box: Box,
  area: PrintArea,
): { x: number; y: number } {
  let x = box.x;
  let y = box.y;

  if (x + box.width > area.x + area.width) x = area.x + area.width - box.width;
  if (y + box.height > area.y + area.height)
    y = area.y + area.height - box.height;

  x = Math.max(x, area.x);
  y = Math.max(y, area.y);

  return { x, y };
}

const EMPTY_DESIGN: DesignState = { front: [], back: [] };

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidElement(value: unknown): value is DesignElement {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  if (typeof e.id !== "string" || e.id.length === 0) return false;
  if (!isNumber(e.x) || !isNumber(e.y)) return false;
  if (!isNumber(e.scaleX) || !isNumber(e.scaleY) || !isNumber(e.rotation)) {
    return false;
  }
  if (e.kind === "text") {
    return (
      typeof e.content === "string" &&
      typeof e.fontFamily === "string" &&
      typeof e.fill === "string" &&
      isNumber(e.fontSize)
    );
  }
  if (e.kind === "image") {
    return typeof e.url === "string" && isNumber(e.width) && isNumber(e.height);
  }
  return false;
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
