import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { PRINT_METHODS } from "./cart";
import { ORDER_STATES } from "./order-status";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/0001_init.sql"),
  "utf8",
);

function enumValues(name: string): string[] {
  const m = new RegExp(`create type ${name} as enum \\(([^)]*)\\)`, "i").exec(sql);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^'|'$/g, ""));
}

describe("schema contracts (SQL enums vs app)", () => {
  it("DB print_method enum matches the single app list", () => {
    expect(enumValues("print_method")).toEqual([...PRINT_METHODS]);
  });

  it("DB order_status enum matches the app state machine", () => {
    expect(enumValues("order_status")).toEqual([...ORDER_STATES]);
  });
});
