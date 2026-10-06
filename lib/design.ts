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
