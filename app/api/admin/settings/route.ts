import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import {
  adminSettingsSchema,
  updateAdminSettings,
} from "@/lib/admin-settings";
import { issuesOf } from "@/lib/orders";

export async function POST(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings", fields: issuesOf(parsed.error) },
      { status: 400 },
    );
  }

  try {
    await updateAdminSettings(parsed.data);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not save settings: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
