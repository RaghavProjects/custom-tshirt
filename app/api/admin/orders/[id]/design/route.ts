import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { data } = await supabaseAdmin()
    .from("orders")
    .select(
      "id,quantity,size_breakdown,print_method,unit_price,total_price,created_at,designs(id,shirt_color,front_elements,back_elements,asset_urls)",
    )
    .eq("id", id)
    .single();

  if (!data) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="design-${id}.json"`,
    },
  });
}
