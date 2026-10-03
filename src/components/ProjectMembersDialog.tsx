import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X, Crown } from "lucide-react";
import { Project, ProjectMember, canAssignTeamlead, canManageProject } from "@/lib/projectTree";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  project: Project;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdate: (patch: Partial<Project>) => void;
}

interface UserOpt {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export function ProjectMembersDialog({ project, open, onOpenChange, onUpdate }: Props) {
  const { user, role } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(false);

  const canManage = canManageProject(project, user?.id, role as any);
  const canSetLead = canAssignTeamlead(role as any);

  useEffect(() => {
    if (!open) return;
    const fetchUsers = async () => {
      setLoading(true);
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email").order("name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
      const list: UserOpt[] = (profilesRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name || p.email || "—",
        email: p.email,
        role: roleMap.get(p.id) || "user",
      }));
      setUsers(list);
      setLoading(false);
    };
    fetchUsers();
  }, [open]);

  const teamleadOptions = users.filter((u) => u.role === "teamlead" || u.role === "admin");
  const memberOptions = users.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const setTeamlead = (id: string | null) => {
    if (!canSetLead) return;
    const u = users.find((x) => x.id === id);
    onUpdate({ teamleadId: id || undefined });
    toast.success(u ? `Тимлид: ${u.name}` : "Тимлид снят");
  };

  const addMember = (u: UserOpt) => {
    if (!canManage) return;
    if (project.members.some((m) => m.userId === u.id)) return;
    const member: ProjectMember = { userId: u.id, name: u.name, email: u.email || undefined };
    onUpdate({ members: [...project.members, member] });
  };

  const removeMember = (uid: string) => {
    if (!canManage) return;
    onUpdate({ members: project.members.filter((m) => m.userId !== uid) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-pixel text-sm">УЧАСТНИКИ ПРОЕКТА</DialogTitle>
          <DialogDescription className="font-mono text-[10px]">
            Назначьте тимлида и работников. Только менеджер проекта может редактировать список.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Teamlead */}
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground flex items-center gap-1">
              <Crown className="h-3 w-3" /> ТИМЛИД ПРОЕКТА
            </label>
            {project.teamleadId ? (
              <div className="mt-1 flex items-center justify-between p-2 retro-outset bg-card">
                <span className="text-xs font-mono">
                  {users.find((u) => u.id === project.teamleadId)?.name || project.teamleadId}
                </span>
                {canSetLead && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setTeamlead(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground font-mono mt-1">Тимлид не назначен</p>
            )}
            {canSetLead && (
              <div className="mt-2 retro-inset bg-background p-2 max-h-32 overflow-y-auto">
                {teamleadOptions.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground font-mono text-center py-1">Нет тимлидов</p>
                ) : (
                  teamleadOptions.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setTeamlead(u.id)}
                      className="w-full text-left p-1 text-xs font-mono hover:bg-accent flex items-center justify-between gap-2"
                      disabled={project.teamleadId === u.id}
                    >
                      <span className="truncate">{u.name}</span>
                      <Badge variant="outline" className="text-[9px]">{u.role}</Badge>
                    </button>
                  ))
                )}
              </div>
            )}
            {!canSetLead && (
              <p className="text-[10px] text-muted-foreground font-mono mt-1">Только админ может назначать тимлида.</p>
            )}
          </div>

          {/* Members */}
          <div>
            <label className="text-[10px] font-pixel text-muted-foreground">РАБОТНИКИ ({project.members.length})</label>
            {project.members.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {project.members.map((m) => (
                  <Badge key={m.userId} variant="secondary" className="text-[10px] gap-1 pr-1">
                    {m.name}
                    {canManage && (
                      <button onClick={() => removeMember(m.userId)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}
            {canManage && (
              <>
                <Input
                  placeholder="Поиск пользователя..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mt-2 text-xs"
                />
                <div className="mt-2 retro-inset bg-background p-2 max-h-48 overflow-y-auto space-y-1">
                  {loading ? (
                    <p className="text-[10px] text-center text-muted-foreground font-mono">Загрузка...</p>
                  ) : memberOptions.length === 0 ? (
                    <p className="text-[10px] text-center text-muted-foreground font-mono">Никого не найдено</p>
                  ) : (
                    memberOptions.map((u) => {
                      const added = project.members.some((m) => m.userId === u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between gap-2 p-1 hover:bg-accent/50">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-mono truncate">{u.name}</div>
                            <div className="text-[9px] text-muted-foreground truncate">{u.email}</div>
                          </div>
                          <Badge variant="outline" className="text-[9px]">{u.role}</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => addMember(u)}
                            disabled={added}
                          >
                            {added ? <X className="h-3 w-3 opacity-30" /> : <UserPlus className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
            {!canManage && (
              <p className="text-[10px] text-muted-foreground font-mono mt-1">Только менеджер проекта может изменять состав.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
