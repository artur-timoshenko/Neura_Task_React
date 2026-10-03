import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import UserDashboard from "./UserDashboard";

import type { Board } from "@/lib/boards";

export default function Index({ board = "motion" }: { board?: Board }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (role === "admin" || role === "teamlead") return <AdminDashboard board={board} />;
  return <UserDashboard board={board} />;
}
