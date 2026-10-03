import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, BarChart3 } from "lucide-react";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface UserStats {
  userId: string;
  userName: string;
  doneTasks: number;
  totalTasks: number;
  workloadHours: number; // sum of complexity of active tasks
}

const MAX_HOURS_PER_DAY = 8;

type PeriodPreset = "today" | "3d" | "7d" | "30d" | "90d" | "custom";

export default function StatsPage() {
  const { role, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  useEffect(() => {
    const now = new Date();
    if (period === "today") {
      setDateFrom(startOfDay(now));
      setDateTo(now);
    } else if (period === "3d") {
      setDateFrom(subDays(now, 3));
      setDateTo(now);
    } else if (period === "7d") {
      setDateFrom(subDays(now, 7));
      setDateTo(now);
    } else if (period === "30d") {
      setDateFrom(subDays(now, 30));
      setDateTo(now);
    } else if (period === "90d") {
      setDateFrom(subMonths(now, 3));
      setDateTo(now);
    }
  }, [period]);

  useEffect(() => {
    if (role !== "admin") return;
    fetchStats();
  }, [role, dateFrom, dateTo]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_user_stats", {
        _from: startOfDay(dateFrom).toISOString(),
        _to: endOfDay(dateTo).toISOString(),
      });
      if (error || !data) return;
      const userStats: UserStats[] = data.map((r) => ({
        userId: r.user_id,
        userName: r.user_name || "—",
        doneTasks: Number(r.done_tasks) || 0,
        totalTasks: Number(r.total_tasks) || 0,
        workloadHours: Number(r.workload_hours) || 0,
      }));
      setStats(userStats);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;
  if (role !== "admin") return <Navigate to="/" replace />;

  const dateLocale = lang === "ru" ? ru : enUS;
  

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-lg font-pixel">{t("stats.title")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("stats.description")}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
              <SelectTrigger className="w-[160px] retro-inset text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("stats.today")}</SelectItem>
                <SelectItem value="3d">{t("stats.3days")}</SelectItem>
                <SelectItem value="7d">{t("stats.7days")}</SelectItem>
                <SelectItem value="30d">{t("stats.30days")}</SelectItem>
                <SelectItem value="90d">{t("stats.90days")}</SelectItem>
                <SelectItem value="custom">{t("stats.custom")}</SelectItem>
              </SelectContent>
            </Select>

            {period === "custom" && (
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="retro-inset text-xs gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(dateFrom, "dd.MM.yy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => d && setDateFrom(d)}
                      locale={dateLocale}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-xs">—</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="retro-inset text-xs gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {format(dateTo, "dd.MM.yy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => d && setDateTo(d)}
                      locale={dateLocale}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">{t("auth.loading")}</p>
        ) : (
          <div className="grid gap-3">
            {stats.map((user) => (
              <Card key={user.userId} className="retro-outset">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-pixel text-xs truncate max-w-[200px]">
                      {user.userName}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {user.doneTasks}{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        / {user.totalTasks} {t("stats.total")}
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-4 retro-inset bg-muted overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${user.totalTasks > 0 ? (user.doneTasks / user.totalTasks) * 100 : 0}%`,
                        backgroundColor: "hsl(var(--status-done))",
                      }}
                    />
                  </div>
                  {/* Workload bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground text-xs">{t("stats.workload")}</span>
                      <span className="text-xs font-medium">
                        {user.workloadHours}{t("stats.hours")} {t("stats.of")} {MAX_HOURS_PER_DAY}{t("stats.hours")}
                      </span>
                    </div>
                    <div className="w-full h-3 retro-inset bg-muted overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min((user.workloadHours / MAX_HOURS_PER_DAY) * 100, 100)}%`,
                          backgroundColor: user.workloadHours > MAX_HOURS_PER_DAY
                            ? "hsl(var(--destructive))"
                            : user.workloadHours >= MAX_HOURS_PER_DAY * 0.75
                              ? "hsl(var(--status-review, 45 93% 47%))"
                              : "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {stats.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">
                {t("stats.noData")}
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
