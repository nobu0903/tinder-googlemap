import { notFound } from "next/navigation";
import { AdminScreen } from "@/components/admin/admin-screen";

export default function AdminPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AdminScreen />;
}
