import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser";
import AppNav from "@/components/AppNav";
import StudentSearch from "@/components/StudentSearch";

export default function StudentSearchPage() {
  const me = getCurrentUser();
  if (!me) redirect("/login");
  return (
    <div style={styles.page}>
      <AppNav me={me} active="students" />
      <StudentSearch />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { fontFamily: "Inter, sans-serif", background: "#EEF1EA", color: "#122A28", padding: "40px 32px", minHeight: "100vh", boxSizing: "border-box" },
};
