import { notFound } from "next/navigation";
import { AdminUnlockScreen } from "@/components/admin/admin-unlock-screen";
import { unlockEntryAllowed } from "@/lib/admin/auth";

/**
 * Unlock form. Production returns 404 unless ?k= matches ADMIN_UNLOCK_KEY.
 */
export default async function AdminUnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string | string[] }>;
}) {
  const params = await searchParams;
  const presented = Array.isArray(params.k) ? params.k[0] : params.k;
  if (!(await unlockEntryAllowed(presented))) notFound();
  return <AdminUnlockScreen />;
}
