import type { DesignElement } from "@/lib/design";

const STAGE_W = 520;
const STAGE_H = 600;

export default function DesignPreview({
  shirtColor,
  elements,
  label,
  width = 220,
}: {
  shirtColor: string;
  elements: DesignElement[];
  label: string;
  width?: number;
}) {
  const scale = width / STAGE_W;
  const height = STAGE_H * scale;

  return (
    <figure>
      <div
        style={{
          width,
          height,
          background: shirtColor,
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {elements.map((el) =>
          el.kind === "text" ? (
            <span
              key={el.id}
              style={{
                position: "absolute",
                left: el.x * scale,
                top: el.y * scale,
                color: el.fill,
                fontFamily: el.fontFamily,
                fontSize: el.fontSize * scale * (el.scaleX || 1),
                transform: `rotate(${el.rotation}deg)`,
                transformOrigin: "top left",
              }}
            >
              {el.content}
            </span>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={el.id}
              src={el.url}
              alt="Artwork"
              style={{
                position: "absolute",
                left: el.x * scale,
                top: el.y * scale,
                width: el.width * scale * (el.scaleX || 1),
                height: el.height * scale * (el.scaleY || 1),
                transform: `rotate(${el.rotation}deg)`,
                transformOrigin: "top left",
              }}
            />
          ),
        )}
      </div>
      <figcaption className="mt-1 text-xs text-muted">{label}</figcaption>
    </figure>
  );
}
