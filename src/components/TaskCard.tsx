import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { Constants } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  assigneeName?: string;
  showAssignee?: boolean;
}

export function TaskCard({ task, onStatusChange, assigneeName, showAssignee }: TaskCardProps) {
  return (
    <div className="group bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate">{task.title}</h3>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <StatusBadge status={task.status} />
            {showAssignee && assigneeName && (
              <span className="text-xs text-muted-foreground font-mono">{assigneeName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        {onStatusChange && (
          <Select
            value={task.status}
            onValueChange={(val) => onStatusChange(task.id, val as TaskStatus)}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Constants.public.Enums.task_status.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
