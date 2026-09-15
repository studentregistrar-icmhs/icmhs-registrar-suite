import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth/currentUser";
import ManageUsers from "@/components/ManageUsers";

export default function ManageUsersPage() {
  const me = getCurrentUser();
  if (!me || !isAdmin(me)) redirect("/");
  return <ManageUsers currentUserId={me.userId} />;
}
