"use client";

import Konva from "konva";
import { useEffect, useRef } from "react";
import {
  Image as KImage,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import type { DesignElement, PrintArea } from "@/lib/design";

type CanvasProps = {
  width: number;
  height: number;
  shirtColor: string;
  printArea: PrintArea;
  elements: DesignElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, attrs: Partial<DesignElement>) => void;
};

/** Pick a print-area line that stays visible on light and dark shirts. */
function printAreaStroke(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "rgba(0,0,0,0.35)";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.55)";
}

/** Nudge a node back inside the print area, whatever its rotation/scale. */
function clampNodeToArea(node: Konva.Node, area: PrintArea) {
  const r = node.getClientRect();
  let dx = 0;
  let dy = 0;

  if (r.x < area.x) dx = area.x - r.x;
  if (r.x + r.width > area.x + area.width)
    dx = area.x + area.width - (r.x + r.width);
  if (r.y < area.y) dy = area.y - r.y;
  if (r.y + r.height > area.y + area.height)
    dy = area.y + area.height - (r.y + r.height);

  node.x(node.x() + dx);
  node.y(node.y() + dy);
}

function ArtImage({
  el,
  isSelected,
  register,
  onSelect,
  onChange,
  printArea,
}: {
  el: Extract<DesignElement, { kind: "image" }>;
  isSelected: boolean;
  register: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string | null) => void;
  onChange: (id: string, attrs: Partial<DesignElement>) => void;
  printArea: PrintArea;
}) {
  const [image] = useImage(el.url, "anonymous");

  return (
    <KImage
      ref={(node) => register(el.id, node)}
      image={image ?? undefined}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      scaleX={el.scaleX}
      scaleY={el.scaleY}
      rotation={el.rotation}
      draggable
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
      onDragMove={(e) => clampNodeToArea(e.target, printArea)}
      onDragEnd={(e) => {
        clampNodeToArea(e.target, printArea);
        onChange(el.id, { x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        clampNodeToArea(node, printArea);
        onChange(el.id, {
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        });
      }}
      strokeEnabled={isSelected}
    />
  );
}

export default function Canvas({
  width,
  height,
  shirtColor,
  printArea,
  elements,
  selectedId,
  onSelect,
  onChange,
}: CanvasProps) {
  const trRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Node>());

  const register = (id: string, node: Konva.Node | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodes.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements]);

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onSelect(null);
      }}
    >
      <Layer>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={shirtColor}
          cornerRadius={24}
        />
        <Rect
          x={printArea.x}
          y={printArea.y}
          width={printArea.width}
          height={printArea.height}
          stroke={printAreaStroke(shirtColor)}
          dash={[8, 6]}
          strokeWidth={1}
          listening={false}
        />
      </Layer>

      <Layer>
        {elements.map((el) =>
          el.kind === "text" ? (
            <Text
              key={el.id}
              ref={(node) => register(el.id, node)}
              text={el.content}
              fontFamily={el.fontFamily}
              fontSize={el.fontSize}
              fill={el.fill}
              x={el.x}
              y={el.y}
              scaleX={el.scaleX}
              scaleY={el.scaleY}
              rotation={el.rotation}
              draggable
              onClick={() => onSelect(el.id)}
              onTap={() => onSelect(el.id)}
              onDragMove={(e) => clampNodeToArea(e.target, printArea)}
              onDragEnd={(e) => {
                clampNodeToArea(e.target, printArea);
                onChange(el.id, { x: e.target.x(), y: e.target.y() });
              }}
              onTransformEnd={(e) => {
                const node = e.target;
                clampNodeToArea(node, printArea);
                onChange(el.id, {
                  x: node.x(),
                  y: node.y(),
                  scaleX: node.scaleX(),
                  scaleY: node.scaleY(),
                  rotation: node.rotation(),
                });
              }}
            />
          ) : (
            <ArtImage
              key={el.id}
              el={el}
              isSelected={selectedId === el.id}
              register={register}
              onSelect={onSelect}
              onChange={onChange}
              printArea={printArea}
            />
          ),
        )}
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 16 || newBox.height < 16 ? oldBox : newBox
          }
        />
      </Layer>
    </Stage>
  );
}
