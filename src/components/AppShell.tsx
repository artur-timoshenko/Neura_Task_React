import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Settings, Menu, X, Globe, BarChart3, FolderTree, MessageCircle, BookOpen, Moon, Sun } from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useNavigate, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useBoards } from "@/hooks/useBoards";
import { boardIcon } from "@/lib/boards";
import { useTheme } from "next-themes";

export function AppShell({ children }: { children: ReactNode }) {
  const { role, profile, signOut, user } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = role === "admin";
  const isTeamlead = role === "teamlead";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { boards } = useBoards();
  const [userBoards, setUserBoards] = useState<Set<string>>(new Set());
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!user || isAdmin || isTeamlead) {
      setUserBoards(new Set());
      return;
    }
    const loadBoards = async () => {
      const { data } = await supabase.from("tasks").select("board").eq("user_id", user.id);
      const boards = new Set<string>((data || []).map((r: any) => r.board || "motion"));
      setUserBoards(boards);
    };
    loadBoards();
    const channel = supabase
      .channel("user-boards-nav")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` }, () => loadBoards())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isAdmin, isTeamlead]);

  const visibleBoards = boards.filter((b) => isAdmin || isTeamlead || userBoards.has(b.slug));

  const navTo = (path: string) => { navigate(path); setMobileOpen(false); };

  const toggleLang = () => setLang(lang === "ru" ? "en" : "ru");

  const navItems = (
    <>
      {visibleBoards.map((b) => {
        const Icon = boardIcon(b.icon);
        const path = `/${b.slug}`;
        const active = location.pathname === path || (b.slug === "motion" && location.pathname === "/");
        return (
          <button key={b.slug} onClick={() => navTo(path)}
            className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] transition-colors ${active ? "retro-inset bg-primary/20 text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <Icon className="h-5 w-5 md:h-4 md:w-4" /> {lang === "ru" ? b.name_ru : b.name_en}
          </button>
        );
      })}
      {isAdmin && (
        <>
          <button onClick={() => navTo("/users")}
            className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] transition-colors ${location.pathname === "/users" ? "retro-inset bg-primary/20 text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <Users className="h-5 w-5 md:h-4 md:w-4" /> {t("nav.users")}
          </button>
          <button onClick={() => navTo("/stats")}
            className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] transition-colors ${location.pathname === "/stats" ? "retro-inset bg-primary/20 text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
            <BarChart3 className="h-5 w-5 md:h-4 md:w-4" /> {t("nav.stats")}
          </button>
        </>
      )}
      <button onClick={() => navTo("/projects")}
        className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] transition-colors ${location.pathname === "/projects" ? "retro-inset bg-primary/20 text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
        <FolderTree className="h-5 w-5 md:h-4 md:w-4" /> {lang === "ru" ? "Проекты" : "Projects"}
      </button>
      <button onClick={() => navTo("/chats")}
        className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] transition-colors ${location.pathname === "/chats" ? "retro-inset bg-primary/20 text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
        <MessageCircle className="h-5 w-5 md:h-4 md:w-4" /> {t("nav.chats")}
      </button>
      <button onClick={() => navTo("/guides")}
        className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] transition-colors ${location.pathname.startsWith("/guides") ? "retro-inset bg-primary/20 text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
        <BookOpen className="h-5 w-5 md:h-4 md:w-4" /> {t("nav.guides")}
      </button>
      <button onClick={() => navTo("/settings")}
        className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] transition-colors ${location.pathname === "/settings" ? "retro-inset bg-primary/20 text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
        <Settings className="h-5 w-5 md:h-4 md:w-4" /> {t("nav.settings")}
      </button>
      <button onClick={toggleLang}
        className="w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
        <Globe className="h-5 w-5 md:h-4 md:w-4" /> {lang === "ru" ? "RU" : "EN"}
      </button>
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="w-full flex items-center gap-3 px-3 py-3 md:py-2 text-[13px] md:text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        aria-label={resolvedTheme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      >
        {resolvedTheme === "dark"
          ? <Sun className="h-5 w-5 md:h-4 md:w-4" />
          : <Moon className="h-5 w-5 md:h-4 md:w-4" />}
        {lang === "ru"
          ? resolvedTheme === "dark" ? "Светлая тема" : "Тёмная тема"
          : resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
      </button>

    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile header */}
      <div className="md:hidden retro-titlebar flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CompanyLogo className="h-6 w-6" iconClassName="h-4 w-4" />
          <span className="font-pixel text-[11px]">Neura Team</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" className="p-1">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[38px] z-50 bg-sidebar-background p-3 space-y-1.5 overflow-y-auto bg-secondary text-secondary">
          {navItems}
          <div className="mt-4 flex items-center gap-2 px-2 py-2 border-t border-border">
            <Avatar className="h-10 w-10 retro-outset">
              <AvatarImage src={(profile as any)?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary-foreground text-[10px] font-pixel">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate text-secondary-foreground">{profile?.name || "User"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="shrink-0 h-9 w-9 text-sidebar-foreground hover:bg-destructive/20">
              <LogOut className="h-5 w-5 text-secondary-foreground" />
            </Button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col shrink-0 retro-outset bg-sidebar-background">
        <div className="retro-titlebar flex items-center gap-2">
          <CompanyLogo className="h-5 w-5" iconClassName="h-3 w-3" />
          <span className="font-pixel text-[10px]">Neura Team</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">{navItems}</nav>
        <div className="p-2 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <Avatar className="h-8 w-8 retro-outset">
              <AvatarImage src={(profile as any)?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary-foreground text-[9px] font-pixel">
                {profile?.name?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold truncate">{profile?.name || "User"}</p>
              <p className="text-[9px] text-muted-foreground truncate">{isAdmin ? "⭐ admin" : isTeamlead ? "🛡 teamlead" : "user"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="shrink-0 h-7 w-7 hover:bg-destructive/20">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
