"use client";

import Konva from "konva";
import { useEffect, useRef } from "react";
import {
  Group,
  Image as KImage,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import useImage from "use-image";
import { luminance, type DesignElement, type PrintArea } from "@/lib/design";

type CanvasProps = {
  width: number;
  height: number;
  scale: number;
  shirtColor: string;
  printArea: PrintArea;
  elements: DesignElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, attrs: Partial<DesignElement>) => void;
};

/** Nudge a node back inside the print area, whatever its rotation/scale. */
function clampNodeToArea(
  node: Konva.Node,
  area: PrintArea,
  relativeTo: Konva.Container,
) {
  // Coordinates in the group's own (logical, unscaled) space, so this is
  // correct at any responsive scale.
  const r = node.getClientRect({ relativeTo });
  let dx = 0;
  let dy = 0;

  // Use else-if so the two edges cannot overwrite each other's correction.
  if (r.width <= area.width) {
    if (r.x < area.x) dx = area.x - r.x;
    else if (r.x + r.width > area.x + area.width)
      dx = area.x + area.width - (r.x + r.width);
  }
  if (r.height <= area.height) {
    if (r.y < area.y) dy = area.y - r.y;
    else if (r.y + r.height > area.y + area.height)
      dy = area.y + area.height - (r.y + r.height);
  }

  node.x(node.x() + dx);
  node.y(node.y() + dy);
}

function ArtImage({
  el: _el,
  register,
  onSelect,
  onChange,
  printArea,
  inkBlend,
  groupRef,
}: {
  el: Extract<DesignElement, { kind: "image" }>;
  register: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string | null) => void;
  onChange: (id: string, attrs: Partial<DesignElement>) => void;
  printArea: PrintArea;
  inkBlend: GlobalCompositeOperation;
  groupRef: React.RefObject<Konva.Group | null>;
}) {
  const el = _el;
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
      globalCompositeOperation={inkBlend}
      draggable
      onClick={() => onSelect(el.id)}
      onTap={() => onSelect(el.id)}
      onDragMove={(e) => {
        if (groupRef.current) clampNodeToArea(e.target, printArea, groupRef.current);
      }}
      onDragEnd={(e) => {
        if (groupRef.current) clampNodeToArea(e.target, printArea, groupRef.current);
        onChange(el.id, { x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        if (groupRef.current) clampNodeToArea(node, printArea, groupRef.current);
        onChange(el.id, {
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        });
      }}
    />
  );
}

export default function Canvas({
  width,
  height,
  scale,
  shirtColor,
  printArea,
  elements,
  selectedId,
  onSelect,
  onChange,
}: CanvasProps) {
  const trRef = useRef<Konva.Transformer>(null);
  const groupRef = useRef<Konva.Group>(null);
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

  // On a light shirt, multiply lets the fabric colour show through the ink
  // (a printed look). On a dark shirt, ink sits on top, as it must.
  const light = luminance(shirtColor) > 0.5;
  const inkBlend: GlobalCompositeOperation = light ? "multiply" : "source-over";
  const guideStroke = light ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)";

  return (
    <Stage
      width={width * scale}
      height={height * scale}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onSelect(null);
      }}
    >
      <Layer>
        {/* One scaled group: everything lives in logical (unscaled) units, and
            Konva scales the group natively, so pointer/drag maths stays right
            at every screen size. */}
        <Group ref={groupRef} scaleX={scale} scaleY={scale}>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={shirtColor}
            cornerRadius={24}
            listening={false}
          />
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            cornerRadius={24}
            listening={false}
            fillRadialGradientStartPoint={{ x: width * 0.5, y: height * 0.32 }}
            fillRadialGradientStartRadius={40}
            fillRadialGradientEndPoint={{ x: width * 0.5, y: height * 0.5 }}
            fillRadialGradientEndRadius={width * 0.8}
            fillRadialGradientColorStops={[
              0,
              "rgba(255,255,255,0.16)",
              0.45,
              "rgba(255,255,255,0)",
              1,
              "rgba(0,0,0,0.26)",
            ]}
          />

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
                globalCompositeOperation={inkBlend}
                draggable
                onClick={() => onSelect(el.id)}
                onTap={() => onSelect(el.id)}
                onDragMove={(e) => {
                  if (groupRef.current)
                    clampNodeToArea(e.target, printArea, groupRef.current);
                }}
                onDragEnd={(e) => {
                  if (groupRef.current)
                    clampNodeToArea(e.target, printArea, groupRef.current);
                  onChange(el.id, { x: e.target.x(), y: e.target.y() });
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  if (groupRef.current)
                    clampNodeToArea(node, printArea, groupRef.current);
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
                register={register}
                onSelect={onSelect}
                onChange={onChange}
                printArea={printArea}
                inkBlend={inkBlend}
                groupRef={groupRef}
              />
            ),
          )}

          <Rect
            x={printArea.x}
            y={printArea.y}
            width={printArea.width}
            height={printArea.height}
            stroke={guideStroke}
            dash={[8, 6]}
            strokeWidth={1}
            listening={false}
          />

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 16 || newBox.height < 16 ? oldBox : newBox
            }
          />
        </Group>
      </Layer>
    </Stage>
  );
}
