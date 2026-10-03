import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/CompanyLogo";
import { LogOut } from "lucide-react";

/**
 * Gate: only users who were explicitly granted a role by an admin/teamlead
 * can access any app functionality. Without a role — nothing is visible.
 */
export function RequireRole({ children }: { children: ReactNode }) {
  const { user, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="retro-outset bg-card p-6 max-w-md w-full text-center space-y-4">
          <div className="flex justify-center">
            <CompanyLogo className="h-10 w-10" iconClassName="h-6 w-6" />
          </div>
          <h1 className="font-pixel text-[12px] leading-relaxed">ДОСТУП НЕ ВЫДАН</h1>
          <p className="text-xs font-mono text-muted-foreground">
            Ваш аккаунт создан, но роль ещё не назначена. Доступ к задачам, чатам и остальным разделам
            появится после того, как администратор или тимлид назначит вам роль.
          </p>
          <Button variant="outline" onClick={signOut} className="w-full">
            <LogOut className="h-3.5 w-3.5 mr-2" /> Выйти
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
