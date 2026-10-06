import type { DesignElement, PrintArea } from "./design";

/**
 * Output resolution. The owner has not supplied the printer's real DPI or the
 * physical print size yet (PRD §8), so this is a flagged placeholder: stage
 * units are treated as 72dpi points and scaled to the target DPI.
 */
export const PLACEHOLDER_PRINT_DPI = 300;
export const STAGE_DPI = 72;

/** Conversion from studio stage units to output pixels at a given DPI. */
export function stageScale(dpi: number = PLACEHOLDER_PRINT_DPI): number {
  return dpi / STAGE_DPI;
}

export function computeOutputSize(
  printArea: PrintArea,
  dpi: number = PLACEHOLDER_PRINT_DPI,
): { width: number; height: number } {
  const scale = stageScale(dpi);
  return {
    width: Math.round(printArea.width * scale),
    height: Math.round(printArea.height * scale),
  };
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function elementToSvg(el: DesignElement, area: PrintArea): string {
  const x = el.x - area.x;
  const y = el.y - area.y;
  const transform = `translate(${x} ${y}) rotate(${el.rotation}) scale(${el.scaleX} ${el.scaleY})`;

  if (el.kind === "text") {
    return `  <g transform="${transform}"><text x="0" y="0" font-family="${escapeXml(
      el.fontFamily,
    )}" font-size="${el.fontSize}" fill="${escapeXml(
      el.fill,
    )}" dominant-baseline="text-before-edge">${escapeXml(
      el.content,
    )}</text></g>`;
  }

  return `  <g transform="${transform}"><image href="${escapeXml(
    el.url,
  )}" width="${el.width}" height="${el.height}" /></g>`;
}

/**
 * A transparent print file: only the ink, sized to the print area, no shirt
 * colour. Used for DTF/vinyl (rasterised to PNG) and as the vector path for
 * embroidery (SVG). Includes images as <image> references for SVG consumers
 * (embroidery software); the PNG path rasterises text with SVG and composites
 * images separately, because sharp's SVG renderer does not load rasters.
 */
export function designToSvg({
  printArea,
  elements,
  dpi = PLACEHOLDER_PRINT_DPI,
}: {
  printArea: PrintArea;
  elements: DesignElement[];
  dpi?: number;
}): string {
  const { width, height } = computeOutputSize(printArea, dpi);
  const body = elements.map((el) => elementToSvg(el, printArea)).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${printArea.width} ${printArea.height}">
${body}
</svg>`;
}

/** Text-only SVG layer, the part sharp can rasterise reliably. */
export function textLayerSvg({
  printArea,
  elements,
  dpi = PLACEHOLDER_PRINT_DPI,
}: {
  printArea: PrintArea;
  elements: DesignElement[];
  dpi?: number;
}): string {
  const { width, height } = computeOutputSize(printArea, dpi);
  const body = elements
    .filter((el) => el.kind === "text")
    .map((el) => elementToSvg(el, printArea))
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${printArea.width} ${printArea.height}">
${body}
</svg>`;
}

/**
 * Top-left for compositing a rotated image so it matches Konva, which rotates
 * about the element's own top-left origin. `rotatedWidth/Height` are the
 * dimensions of the already-rotated raster.
 */
export function compositePosition({
  el,
  printArea,
  rotatedWidth,
  rotatedHeight,
  dpi = PLACEHOLDER_PRINT_DPI,
}: {
  el: DesignElement;
  printArea: PrintArea;
  rotatedWidth: number;
  rotatedHeight: number;
  dpi?: number;
}): { left: number; top: number } {
  const scale = stageScale(dpi);
  const theta = (el.rotation * Math.PI) / 180;
  const w = el.kind === "image" ? el.width * el.scaleX * scale : 0;
  const h = el.kind === "image" ? el.height * el.scaleY * scale : 0;
  const targetX = (el.x - printArea.x) * scale;
  const targetY = (el.y - printArea.y) * scale;

  return {
    left:
      targetX -
      rotatedWidth / 2 +
      (w / 2) * Math.cos(theta) -
      (h / 2) * Math.sin(theta),
    top:
      targetY -
      rotatedHeight / 2 +
      (w / 2) * Math.sin(theta) +
      (h / 2) * Math.cos(theta),
  };
}
