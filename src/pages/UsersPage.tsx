import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Ban, Mail, MailCheck, Lock, Trash2, Pencil, ShieldCheck, Users as UsersIcon, Tag, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { logAction } from "@/lib/actionLog";
import { useAuth } from "@/contexts/AuthContext";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = "admin" | "teamlead" | "buyer" | "user";

export default function UsersPage() {
  const { t } = useLanguage();
  const { role } = useAuth();
  const [visits, setVisits] = useState<Record<string, { ip_address: unknown; country: string | null; last_seen_at: string }>>({});
  const [visitError, setVisitError] = useState(false);
  useEffect(() => {
    if (role !== "admin") return;
    const load = async () => {
      const { data, error } = await supabase.from("user_last_visits").select("*");
      setVisitError(!!error);
      if (data) setVisits(Object.fromEntries(data.map(v => [v.user_id, v])));
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [role]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [userRoles, setUserRoles] = useState<Record<string, AppRole>>({});
  const [memberships, setMemberships] = useState<Record<string, string[]>>({}); // teamlead_id -> member_ids[]
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyingEmailId, setVerifyingEmailId] = useState<string | null>(null);
  const [verifiedEmailIds, setVerifiedEmailIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editAction, setEditAction] = useState<"password" | "email" | "name" | "realname" | "buyerteam" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);

  const [roleUser, setRoleUser] = useState<Profile | null>(null);
  const [roleValue, setRoleValue] = useState<AppRole>("user");
  const [roleLoading, setRoleLoading] = useState(false);

  const [teamUser, setTeamUser] = useState<Profile | null>(null);
  const [teamSelected, setTeamSelected] = useState<Set<string>>(new Set());
  const [teamLoading, setTeamLoading] = useState(false);

  const [tagsUser, setTagsUser] = useState<Profile | null>(null);
  const [tagsValue, setTagsValue] = useState("");
  const [tagsLoading, setTagsLoading] = useState(false);

  const [showBuyers, setShowBuyers] = useState(true);
  const [showDesigners, setShowDesigners] = useState(true);

  const [realNames, setRealNames] = useState<Record<string, string>>({});
  const [buyerTeams, setBuyerTeams] = useState<Record<string, string>>({});

  const saveTags = async () => {
    if (!tagsUser) return;
    setTagsLoading(true);
    const list = tagsValue.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await (supabase as any).from("profiles").update({ tags: list }).eq("id", tagsUser.id);
    if (error) { sonnerToast.error(error.message); setTagsLoading(false); return; }
    sonnerToast.success("Теги сохранены");
    setTagsUser(null); setTagsValue("");
    setTagsLoading(false);
    fetchUsers();
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setUsers(data);
    const [tasksRes, rolesRes, memRes, realRes] = await Promise.all([
      supabase.from("tasks").select("user_id"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("team_memberships").select("teamlead_id, member_id"),
      (supabase as any).from("buyer_real_names").select("buyer_id, real_name, team"),
    ]);
    if (realRes?.data) {
      const rn: Record<string, string> = {};
      const bt: Record<string, string> = {};
      realRes.data.forEach((r: any) => {
        rn[r.buyer_id] = r.real_name;
        if (r.team) bt[r.buyer_id] = r.team;
      });
      setRealNames(rn);
      setBuyerTeams(bt);
    }
    if (tasksRes.data) {
      const counts: Record<string, number> = {};
      tasksRes.data.forEach((t) => { counts[t.user_id] = (counts[t.user_id] || 0) + 1; });
      setTaskCounts(counts);
    }
    if (rolesRes.data) {
      const roles: Record<string, AppRole> = {};
      rolesRes.data.forEach((r: any) => { roles[r.user_id] = r.role as AppRole; });
      setUserRoles(roles);
    }
    if (memRes.data) {
      const m: Record<string, string[]> = {};
      memRes.data.forEach((r: any) => {
        if (!m[r.teamlead_id]) m[r.teamlead_id] = [];
        m[r.teamlead_id].push(r.member_id);
      });
      setMemberships(m);
    }
  };

  useEffect(() => {
    if (role === "admin" || role === "teamlead") void fetchUsers();
  }, [role]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) {
      toast({ title: t("users.createError"), description: error.message, variant: "destructive" });
    } else if (data.user) {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: "user" });
      await logAction({
        action: "created",
        entityType: "user",
        entityId: data.user.id,
        targetUserId: data.user.id,
        details: { name, email },
      });
      toast({ title: t("users.userCreated") });
      setEmail(""); setName(""); setPassword(""); setOpen(false);
      fetchUsers();
    }
    setLoading(false);
  };

  const invokeAdminAction = async (action: string, body: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-manage-user", {
      body: { action, ...body },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message || "Error");
  };

  const handleEditSubmit = async () => {
    if (!editUser || !editAction || (editAction !== "buyerteam" && !editValue.trim())) return;
    setEditLoading(true);
    try {
      if (editAction === "password") {
        if (editValue.length < 6) { sonnerToast.error(t("reset.minError")); setEditLoading(false); return; }
        await invokeAdminAction("change_password", { targetUserId: editUser.id, newPassword: editValue });
        await logAction({ action: "password_changed", entityType: "user", entityId: editUser.id, targetUserId: editUser.id });
        sonnerToast.success(t("users.passwordChanged"));
      } else if (editAction === "email") {
        await invokeAdminAction("change_email", { targetUserId: editUser.id, newEmail: editValue });
        await logAction({ action: "email_changed", entityType: "user", entityId: editUser.id, targetUserId: editUser.id, details: { newEmail: editValue } });
        sonnerToast.success(t("users.emailChanged"));
        fetchUsers();
      } else if (editAction === "name") {
        await invokeAdminAction("change_name", { targetUserId: editUser.id, newName: editValue });
        await logAction({ action: "name_changed", entityType: "user", entityId: editUser.id, targetUserId: editUser.id, details: { newName: editValue } });
        sonnerToast.success(t("users.nameChanged"));
        fetchUsers();
      } else if (editAction === "realname") {
        const { error } = await (supabase as any)
          .from("buyer_real_names")
          .upsert({ buyer_id: editUser.id, real_name: editValue.trim(), updated_at: new Date().toISOString() });
        if (error) throw error;
        sonnerToast.success("Настоящее имя сохранено");
        fetchUsers();
      } else if (editAction === "buyerteam") {
        if (editValue.trim().length > 100) throw new Error("Название команды: максимум 100 символов");
        const { error } = await (supabase as any)
          .from("buyer_real_names")
          .upsert({
            buyer_id: editUser.id,
            real_name: realNames[editUser.id] || editUser.name || "",
            team: editValue.trim() || null,
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
        sonnerToast.success("Команда баера сохранена");
        fetchUsers();
      }
      setEditUser(null); setEditAction(null); setEditValue("");
    } catch (e: any) { sonnerToast.error(e.message); }
    setEditLoading(false);
  };

  const handleBan = async (u: Profile) => {
    const newBanned = !u.banned;
    try {
      await invokeAdminAction("ban", { targetUserId: u.id, banned: newBanned });
      await logAction({ action: newBanned ? "banned" : "unbanned", entityType: "user", entityId: u.id, targetUserId: u.id });
      sonnerToast.success(newBanned ? t("users.userBlocked") : t("users.userUnblocked"));
      fetchUsers();
    } catch (e: any) { sonnerToast.error(e.message); }
  };

  const handleVerifyEmail = async (u: Profile) => {
    setVerifyingEmailId(u.id);
    try {
      await invokeAdminAction("verify_email", { targetUserId: u.id });
      setVerifiedEmailIds((previous) => new Set(previous).add(u.id));
      await logAction({ action: "email_verified", entityType: "user", entityId: u.id, targetUserId: u.id });
      sonnerToast.success(`Почта ${u.email || "пользователя"} подтверждена`);
    } catch (error: any) {
      sonnerToast.error(error.message);
    } finally {
      setVerifyingEmailId(null);
    }
  };

  const handleSaveRole = async () => {
    if (!roleUser) return;
    setRoleLoading(true);
    try {
      await invokeAdminAction("toggle_role", { targetUserId: roleUser.id, newRole: roleValue });
      await logAction({ action: "role_changed", entityType: "user", entityId: roleUser.id, targetUserId: roleUser.id, details: { role: roleValue } });
      sonnerToast.success(t("users.roleChanged"));
      setRoleUser(null);
      fetchUsers();
    } catch (e: any) { sonnerToast.error(e.message); }
    setRoleLoading(false);
  };

  const openTeamDialog = (u: Profile) => {
    setTeamUser(u);
    setTeamSelected(new Set(memberships[u.id] || []));
  };

  const handleSaveTeam = async () => {
    if (!teamUser) return;
    setTeamLoading(true);
    try {
      const ids = Array.from(teamSelected).filter((id) => id !== teamUser.id);
      await invokeAdminAction("set_team_members", { targetUserId: teamUser.id, memberIds: ids });
      await logAction({ action: "team_updated", entityType: "user", entityId: teamUser.id, targetUserId: teamUser.id, details: { memberCount: ids.length } });
      sonnerToast.success(t("users.teamSaved"));
      setTeamUser(null);
      fetchUsers();
    } catch (e: any) { sonnerToast.error(e.message); }
    setTeamLoading(false);
  };

  const toggleTeamMember = (id: string) => {
    setTeamSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      await logAction({ action: "deleted", entityType: "user", entityId: deleteUser.id, targetUserId: deleteUser.id, details: { email: deleteUser.email, name: deleteUser.name } });
      await invokeAdminAction("delete", { targetUserId: deleteUser.id });
      sonnerToast.success(t("users.deleted"));
      setDeleteUser(null);
      fetchUsers();
    } catch (e: any) { sonnerToast.error(e.message); }
  };

  const roleLabel = (r: AppRole) => r === "admin" ? t("users.roleAdmin") : r === "teamlead" ? t("users.roleTeamlead") : r === "buyer" ? "Баер" : t("users.roleUser");
  const roleBadgeClass = (r: AppRole) => r === "admin"
    ? "bg-primary/20 text-primary border-primary/30"
    : r === "teamlead"
    ? "bg-accent/30 text-accent-foreground border-accent"
    : r === "buyer"
    ? "bg-status-review/20 text-status-review border-status-review/30"
    : "bg-muted text-muted-foreground border-border";

  if (role !== "admin" && role !== "teamlead") {
    return (
      <AppShell>
        <div className="p-6 text-sm text-muted-foreground">Нет доступа</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t("users.title")}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{users.length} {t("users.members")}</p>
          </div>
          {role === "admin" && <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs sm:text-sm"><UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">{t("users.add")}</span><span className="sm:hidden">+</span></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("users.createUser")}</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2"><Label>{t("auth.name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                <div className="space-y-2"><Label>{t("auth.email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div className="space-y-2"><Label>{t("auth.password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? t("task.creating") : t("users.create")}</Button>
              </form>
            </DialogContent>
          </Dialog>}
        </div>

        <Dialog open={!!editAction} onOpenChange={(v) => { if (!v) { setEditAction(null); setEditUser(null); setEditValue(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editAction === "password" ? t("users.changePassword") : editAction === "email" ? t("users.changeEmail") : editAction === "realname" ? "Настоящее имя баера" : editAction === "buyerteam" ? "Команда баера" : t("users.changeName")} — {editUser?.name || editUser?.email}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{editAction === "password" ? t("users.newPassword") : editAction === "email" ? t("users.newEmail") : editAction === "realname" ? "Настоящее имя (видят только админы и тимлиды)" : editAction === "buyerteam" ? "Teams (видят только админы и тимлиды)" : t("users.newName")}</Label>
                <Input type={editAction === "password" ? "password" : "text"} value={editValue} onChange={(e) => setEditValue(e.target.value)} maxLength={editAction === "buyerteam" ? 100 : undefined} placeholder={editAction === "password" ? t("reset.minChars") : editAction === "email" ? "new@email.com" : editAction === "realname" ? "ВЛ" : editAction === "buyerteam" ? "Например: Team Alpha" : t("auth.yourName")} />
              </div>
              <Button onClick={handleEditSubmit} className="w-full" disabled={editLoading}>
                {editLoading ? t("users.saving") : t("users.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Role dialog */}
        <Dialog open={!!roleUser} onOpenChange={(v) => { if (!v) setRoleUser(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("users.changeRole")} — {roleUser?.name || roleUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("users.role")}</Label>
                <Select value={roleValue} onValueChange={(v) => setRoleValue(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">{t("users.roleUser")}</SelectItem>
                    <SelectItem value="buyer">Баер</SelectItem>
                    <SelectItem value="teamlead">{t("users.roleTeamlead")}</SelectItem>
                    <SelectItem value="admin">{t("users.roleAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveRole} className="w-full" disabled={roleLoading}>
                {roleLoading ? t("users.saving") : t("users.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Team dialog */}
        <Dialog open={!!teamUser} onOpenChange={(v) => { if (!v) setTeamUser(null); }}>
          <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{t("users.manageTeam")} — {teamUser?.name || teamUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 flex-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground">{t("users.teamMembersDesc")}</p>
              <div className="space-y-1">
                {users.filter((u) => u.id !== teamUser?.id).map((u) => (
                  <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                    <Checkbox checked={teamSelected.has(u.id)} onCheckedChange={() => toggleTeamMember(u.id)} />
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{u.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{u.name || "Unnamed"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{u.email}</p>
                    </div>
                    {userRoles[u.id] && userRoles[u.id] !== "user" && (
                      <Badge variant="outline" className="text-[9px] shrink-0">{roleLabel(userRoles[u.id])}</Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveTeam} className="w-full mt-3" disabled={teamLoading}>
              {teamLoading ? t("users.saving") : t("users.save")} ({teamSelected.size})
            </Button>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteUser} onOpenChange={(v) => { if (!v) setDeleteUser(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("users.deleteUser")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("users.deleteDesc")} <strong>{deleteUser?.name || deleteUser?.email}</strong>{t("users.deleteWarning")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("users.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("users.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Tags dialog */}
        <Dialog open={!!tagsUser} onOpenChange={(v) => { if (!v) { setTagsUser(null); setTagsValue(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Теги — {tagsUser?.name || tagsUser?.email}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label className="text-xs">Введите теги через запятую (например: GEO-US, Nutra, TG)</Label>
              <Input value={tagsValue} onChange={(e) => setTagsValue(e.target.value)} placeholder="tag1, tag2, tag3" />
              <Button onClick={saveTags} className="w-full" disabled={tagsLoading}>{tagsLoading ? t("users.saving") : t("users.save")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-4 mb-3 p-2 border border-border rounded-md bg-muted/30">
          <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
            <Checkbox checked={showBuyers} onCheckedChange={(v) => setShowBuyers(!!v)} />
            <span>Баеры</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
            <Checkbox checked={showDesigners} onCheckedChange={(v) => setShowDesigners(!!v)} />
            <span>Дизайнеры</span>
          </label>
        </div>

        <div className="space-y-2">
          {users.filter((u) => {
            const isBuyer = userRoles[u.id] === "buyer";
            return isBuyer ? showBuyers : showDesigners;
          }).map((u) => {
            const r = userRoles[u.id] || "user";
            const teamCount = (memberships[u.id] || []).length;
            return (
              <div key={u.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-card border rounded-lg animate-fade-in ${u.banned ? "opacity-50 border-destructive/30" : "border-border"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-xs sm:text-sm font-semibold bg-primary/10 text-primary">{u.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs sm:text-sm font-medium truncate">{u.name || "Unnamed"}</p>
                      {u.banned && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">{t("users.blocked")}</Badge>}
                      {r !== "user" && (
                        <Badge className={`text-[10px] px-1.5 py-0 shrink-0 border ${roleBadgeClass(r)}`}>
                          {roleLabel(r)}
                          {r === "teamlead" && teamCount > 0 && ` · ${teamCount}`}
                        </Badge>
                      )}
                      {r === "buyer" && realNames[u.id] && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">Настоящее: {realNames[u.id]}</Badge>
                      )}
                      {r === "buyer" && buyerTeams[u.id] && (
                        <Badge className="text-[10px] px-1.5 py-0 shrink-0 border bg-secondary text-secondary-foreground border-border">Teams: {buyerTeams[u.id]}</Badge>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-mono truncate">{u.email}</p>
                    {role === "admin" && (
                      <div className="mt-1 space-y-0.5 text-[10px] sm:text-xs text-muted-foreground break-words">
                        <p>Последнее посещение: {visits[u.id] ? `${new Date(visits[u.id].last_seen_at).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" })} (Киев)` : visitError ? "Не удалось загрузить" : "Нет данных"}</p>
                        {visits[u.id] && <p>IP: <span className="font-mono break-all">{String(visits[u.id].ip_address || "Не определён")}</span> · Страна: {visits[u.id].country ? new Intl.DisplayNames(["ru"], { type: "region" }).of(visits[u.id].country as string) : "Не определена"}</p>}
                      </div>
                    )}
                    {(((u as any).tags as string[] | undefined) || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(((u as any).tags as string[]) || []).map((tg) => (
                          <Badge key={tg} variant="secondary" className="text-[9px] px-1 py-0">{tg}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 ml-11 sm:ml-0 flex-wrap">
                  <span className="text-[10px] sm:text-sm text-muted-foreground font-mono mr-1 sm:mr-2 whitespace-nowrap">{taskCounts[u.id] || 0} {t("users.tasks")}</span>
                  {role === "admin" && <>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={t("users.changeName")} onClick={() => { setEditUser(u); setEditAction("name"); setEditValue(u.name || ""); }}>
                    <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={t("users.changePassword")} onClick={() => { setEditUser(u); setEditAction("password"); }}>
                    <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={t("users.changeEmail")} onClick={() => { setEditUser(u); setEditAction("email"); }}>
                    <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    title="Подтвердить почту"
                    disabled={verifyingEmailId === u.id || verifiedEmailIds.has(u.id)}
                    onClick={() => handleVerifyEmail(u)}
                  >
                    <MailCheck className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${verifiedEmailIds.has(u.id) ? "text-emerald-500" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={t("users.changeRole")} onClick={() => { setRoleUser(u); setRoleValue(r); }}>
                    <ShieldCheck className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${r === "admin" ? "text-primary" : r === "teamlead" ? "text-accent-foreground" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title="Теги" onClick={() => { setTagsUser(u); setTagsValue((((u as any).tags as string[]) || []).join(", ")); }}>
                    <Tag className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                  {r === "buyer" && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title="Настоящее имя баера" onClick={() => { setEditUser(u); setEditAction("realname"); setEditValue(realNames[u.id] || ""); }}>
                        <UserCog className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title="Teams баера" onClick={() => { setEditUser(u); setEditAction("buyerteam"); setEditValue(buyerTeams[u.id] || ""); }}>
                        <UsersIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-status-review" />
                      </Button>
                    </>
                  )}
                  {r === "teamlead" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={t("users.manageTeam")} onClick={() => openTeamDialog(u)}>
                      <UsersIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-accent-foreground" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" title={u.banned ? t("users.userUnblocked") : t("users.userBlocked")} onClick={() => handleBan(u)}>
                    <Ban className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${u.banned ? "text-destructive" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive" title={t("users.delete")} onClick={() => setDeleteUser(u)}>
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
