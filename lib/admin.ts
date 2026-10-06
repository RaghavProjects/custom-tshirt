import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";

export const ADMIN_COOKIE = "admin_token";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * The signed-in admin, or null. The cookie holds a Supabase access token which
 * is verified on every request; membership is checked against ADMIN_EMAILS.
 */
export async function getAdminUser() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  if (!isAllowedEmail(data.user.email)) return null;

  return data.user;
}
