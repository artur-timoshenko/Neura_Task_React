import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Index from "./Index";
import TaskPage from "./TaskPage";
import type { Board } from "@/lib/boards";

export default function TaskRoute() {
  const { taskCode } = useParams<{ taskCode: string }>();
  const [board, setBoard] = useState<Board>("motion");

  useEffect(() => {
    if (!taskCode) return;
    let cancelled = false;
    const code = taskCode.startsWith("#") ? taskCode : `#${taskCode}`;
    supabase
      .from("tasks")
      .select("board")
      .eq("task_code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const b = (data?.[0] as any)?.board as Board | undefined;
        if (!cancelled && b) setBoard(b);
      });
    return () => { cancelled = true; };
  }, [taskCode]);

  return (
    <>
      <Index board={board} />
      <TaskPage board={board} />
    </>
  );
}
