import { z } from "zod";
import { PRINT_METHODS } from "@/lib/cart";
import { designElementSchema } from "@/lib/design";

export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a hex colour");

export const customerSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone: z.string().trim().min(1, "phone is required"),
  email: z.email("a valid email is required"),
});

export const shippingSchema = z.object({
  line1: z.string().trim().min(1, "address is required"),
  city: z.string().trim().min(1, "city is required"),
  pincode: z.string().trim().min(1, "pincode is required"),
});

// Bounded so one order cannot drive unbounded storage or rasterisation work.
const MAX_ELEMENTS_PER_SIDE = 50;

const designSchema = z.object({
  shirtColor: hexColor,
  front: z.array(designElementSchema).max(MAX_ELEMENTS_PER_SIDE),
  back: z.array(designElementSchema).max(MAX_ELEMENTS_PER_SIDE),
});

const hasElement = (o: { design: z.infer<typeof designSchema> }) =>
  o.design.front.length + o.design.back.length >= 1;
const sizesSumToQuantity = (o: {
  quantity: number;
  sizeBreakdown: Record<string, number>;
}) =>
  Object.values(o.sizeBreakdown).reduce((sum, n) => sum + n, 0) === o.quantity;
const someSizePositive = (o: { sizeBreakdown: Record<string, number> }) =>
  Object.values(o.sizeBreakdown).some((n) => n > 0);

const orderCore = z.object({
  productId: z.string().uuid(),
  colorHex: hexColor,
  quantity: z.number().int().positive(),
  sizeBreakdown: z.record(z.string().min(1), z.number().int().nonnegative()),
  printMethod: z.enum(PRINT_METHODS),
  design: designSchema,
});

/** A single line item: the order fields minus customer/shipping. */
export const orderItemSchema = orderCore
  .refine(hasElement, {
    message: "an order needs at least one design element",
    path: ["design"],
  })
  .refine(sizesSumToQuantity, {
    message: "size breakdown must sum to the quantity",
    path: ["sizeBreakdown"],
  })
  .refine(someSizePositive, {
    message: "at least one size must have quantity above zero",
    path: ["sizeBreakdown"],
  });

export const orderSchema = orderCore
  .extend({ customer: customerSchema, shipping: shippingSchema })
  .refine(hasElement, {
    message: "an order needs at least one design element",
    path: ["design"],
  })
  .refine(sizesSumToQuantity, {
    message: "size breakdown must sum to the quantity",
    path: ["sizeBreakdown"],
  })
  .refine(someSizePositive, {
    message: "at least one size must have quantity above zero",
    path: ["sizeBreakdown"],
  });

export const checkoutSchema = z.object({
  customer: customerSchema,
  shipping: shippingSchema,
  items: z
    .array(orderItemSchema)
    .min(1, "at least one item is required")
    .max(25, "too many items in one checkout"),
});

export type OrderInput = z.infer<typeof orderSchema>;

export type FieldIssue = { path: string; message: string };

export function issuesOf(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}
