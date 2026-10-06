export const ORDER_STATES = [
  "pending_payment",
  "paid",
  "in_production",
  "printed",
  "shipped",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

// Forward-only. A status is set only after the thing actually happened
// (AGENTS.md §3): production cannot start before payment, nothing ships before
// it is printed.
const FORWARD: Record<OrderState, OrderState[]> = {
  pending_payment: [],
  paid: ["in_production"],
  in_production: ["printed"],
  printed: ["shipped"],
  shipped: [],
};

export function nextStates(from: OrderState): OrderState[] {
  return FORWARD[from] ?? [];
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  return nextStates(from).includes(to);
}
