import { notFound } from "next/navigation";
import { AdminUnlockScreen } from "@/components/admin/admin-unlock-screen";

/** Local dev unlock entry. Production answers 404. */
export default function AdminUnlockPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AdminUnlockScreen />;
}
