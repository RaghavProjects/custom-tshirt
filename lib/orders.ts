import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour");

const textElement = z.object({
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

const imageElement = z.object({
  id: z.string().min(1),
  kind: z.literal("image"),
  url: z.string().url(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  scaleX: z.number(),
  scaleY: z.number(),
  rotation: z.number(),
});

const designElement = z.discriminatedUnion("kind", [
  textElement,
  imageElement,
]);

export const orderSchema = z
  .object({
    productId: z.string().uuid(),
    colorHex: hexColor,
    quantity: z.number().int().positive(),
    sizeBreakdown: z.record(z.string().min(1), z.number().int().nonnegative()),
    printMethod: z.enum(["dtf", "embroidery", "vinyl"]),
    customer: z.object({
      name: z.string().trim().min(1, "name is required"),
      phone: z.string().trim().min(1, "phone is required"),
      email: z.email("a valid email is required"),
    }),
    shipping: z.object({
      line1: z.string().trim().min(1, "address is required"),
      city: z.string().trim().min(1, "city is required"),
      pincode: z.string().trim().min(1, "pincode is required"),
    }),
    design: z.object({
      shirtColor: hexColor,
      front: z.array(designElement),
      back: z.array(designElement),
    }),
  })
  .refine(
    (o) => o.design.front.length + o.design.back.length >= 1,
    { message: "an order needs at least one design element", path: ["design"] },
  )
  .refine(
    (o) =>
      Object.values(o.sizeBreakdown).reduce((sum, n) => sum + n, 0) ===
      o.quantity,
    { message: "size breakdown must sum to the quantity", path: ["sizeBreakdown"] },
  )
  .refine(
    (o) => Object.values(o.sizeBreakdown).some((n) => n > 0),
    { message: "at least one size must have quantity above zero", path: ["sizeBreakdown"] },
  );

export type OrderInput = z.infer<typeof orderSchema>;

export type FieldIssue = { path: string; message: string };

export function issuesOf(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}
