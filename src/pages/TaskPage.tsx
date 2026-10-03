import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { useProfiles, buildUserMap } from "@/hooks/useProfiles";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export default function TaskPage({ board = "motion" }: { board?: string }) {
  const { taskCode } = useParams<{ taskCode: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: profiles = [] } = useProfiles(null, role === "admin");
  const users = profiles;
  const userMap = useMemo(() => buildUserMap(profiles), [profiles]);

  useEffect(() => {
    if (!user?.id || !taskCode) return;
    let cancelled = false;

    const fetchTask = async () => {
      const code = taskCode.startsWith("#") ? taskCode : `#${taskCode}`;
      const { data: rows } = await supabase
        .from("tasks")
        .select("*")
        .eq("task_code", code)
        .order("created_at", { ascending: false })
        .limit(1);
      const data = rows?.[0] ?? null;

      if (cancelled) return;

      if (data) {
        setTask(data);
      } else {
        navigate(`/${board}`, { replace: true });
        return;
      }

      if (!cancelled) setLoading(false);
    };

    fetchTask();
    return () => { cancelled = true; };
  }, [user?.id, taskCode, role]);


  useEffect(() => {
    if (!task?.id) return;
    const channel = supabase
      .channel(`task-page-${task.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${task.id}` },
        (payload) => setTask(payload.new as Task)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [task?.id]);

  if (loading || !task) return null;



  return (
    <TaskDetailDialog
      task={task}
      open={true}
      onOpenChange={(open) => {
        if (!open) navigate(`/${board}`, { replace: true });
      }}
      assigneeName={userMap[task.user_id]}
      onDeleted={() => navigate(`/${board}`, { replace: true })}
      onUpdated={() => {
        supabase.from("tasks").select("*").eq("id", task.id).maybeSingle().then(({ data }) => {
          if (data) setTask(data);
        });
      }}
      users={role === "admin" ? users : undefined}
    />
  );
}
