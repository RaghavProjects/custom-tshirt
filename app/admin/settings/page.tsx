import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getAdminSettings } from "@/lib/admin-settings";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const initial = await getAdminSettings();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <Link href="/admin" className="text-sm text-muted underline">
        ← All orders
      </Link>
      <h1 className="mt-4 font-display text-3xl">Settings</h1>
      <p className="mt-2 text-muted">
        Prices and rules the studio reads. Leave a price empty if it is not set
        yet — the app will refuse to order rather than invent one.
      </p>

      <div className="mt-8">
        <SettingsForm initial={initial} />
      </div>
    </main>
  );
}
