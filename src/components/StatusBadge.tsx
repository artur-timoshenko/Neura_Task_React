import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

const statusConfig: Record<TaskStatus, { key: "kanban.todo" | "kanban.inProgress" | "kanban.review" | "kanban.corrections" | "kanban.done"; className: string }> = {
  todo: { key: "kanban.todo", className: "bg-status-todo/15 text-status-todo" },
  in_progress: { key: "kanban.inProgress", className: "bg-status-in-progress/15 text-status-in-progress" },
  review: { key: "kanban.review", className: "bg-status-review/15 text-status-review" },
  corrections: { key: "kanban.corrections", className: "bg-accent/15 text-accent-foreground" },
  done: { key: "kanban.done", className: "bg-status-done/15 text-status-done" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useLanguage();
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-mono", config.className)}>
      {t(config.key)}
    </span>
  );
}
