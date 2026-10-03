import React, { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Paperclip, Clock } from "lucide-react";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { supabase } from "@/integrations/supabase/client";
import { useBoards } from "@/hooks/useBoards";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useDirections } from "@/hooks/useDirections";
import { useImagePaste } from "@/hooks/useImagePaste";
import { logAction } from "@/lib/actionLog";
import { notifyTelegramNewTask } from "@/lib/notifyTelegram";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/RichTextEditor";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface CreateTaskDialogProps {
  users?: Profile[];
  onCreated: () => void;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  defaultBoard?: string;
}

export function CreateTaskDialog({ users, onCreated, externalOpen, onExternalOpenChange, defaultBoard = "motion" }: CreateTaskDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setInternalOpen(v);
  };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [userId, setUserId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [direction, setDirection] = useState("");
  const [complexity, setComplexity] = useState("");
  const [taskCode, setTaskCode] = useState("#");
  const [board, setBoard] = useState<string>(defaultBoard);
  const { boards } = useBoards();
  const [buyerId, setBuyerId] = useState<string>("");
  const [buyers, setBuyers] = useState<Profile[]>([]);
  const [buyerRealNames, setBuyerRealNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { directions: directionsList } = useDirections();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const getDesc = useCallback(() => description, [description]);
  const taRefForPaste = useRef<HTMLTextAreaElement>(null);
  // sync underlying textarea ref into useImagePaste hook
  React.useEffect(() => { taRefForPaste.current = editorRef.current?.textarea ?? null; });
  const handleDescPaste = useImagePaste(getDesc, setDescription, taRefForPaste);

  useEffect(() => { setBoard(defaultBoard); }, [defaultBoard]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "buyer" as any);
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) { setBuyers([]); setBuyerRealNames({}); return; }
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      setBuyers((profs as Profile[]) || []);
      const { data: rn } = await (supabase as any).from("buyer_real_names").select("buyer_id, real_name").in("buyer_id", ids);
      const rmap: Record<string, string> = {};
      (rn || []).forEach((r: any) => { rmap[r.buyer_id] = r.real_name; });
      setBuyerRealNames(rmap);
    })();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;

    const digits = taskCode.replace(/\D/g, "");
    if (!digits) {
      toast({ title: t("task.createError"), description: t("task.code"), variant: "destructive" });
      return;
    }
    const finalTaskCode = "#" + digits;

    setLoading(true);

    {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("task_code", finalTaskCode)
        .eq("board", board)
        .maybeSingle();
      if (existing) {
        toast({ title: t("task.createError"), description: t("task.duplicateCodeError").replace("{code}", finalTaskCode), variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    const { data: taskData, error } = await supabase.from("tasks").insert({
      title: title.trim(),
      description: description.trim() || null,
      user_id: userId,
      created_by: user?.id,
      priority: priority as any,
      direction: direction || null,
      complexity: complexity ? parseFloat(complexity) : null,
      task_code: finalTaskCode,
      board,
      buyer_id: buyerId || null,
    } as any).select("id").single();

    if (error) {
      toast({ title: t("task.createError"), description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (taskData) {
      await logAction({
        action: "created",
        entityType: "task",
        entityId: taskData.id,
        taskId: taskData.id,
        targetUserId: userId,
        details: {
          title: title.trim(),
          taskCode: finalTaskCode,
          priority,
          direction: direction || null,
          complexity: complexity ? parseFloat(complexity) : null,
          board,
        },
      });
    }

    if (files.length > 0 && taskData) {
      for (const file of files) {
        const filePath = `${taskData.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("task-files").upload(filePath, file);
        if (!uploadError) {
          await supabase.from("task_attachments").insert({
            task_id: taskData.id, user_id: user?.id, file_name: file.name, file_path: filePath, file_size: file.size,
          } as any);
          await logAction({
            action: "uploaded",
            entityType: "attachment",
            taskId: taskData.id,
            targetUserId: userId,
            details: {
              fileName: file.name,
              fileSize: file.size,
              category: "attachment",
            },
          });
        } else {
          sonnerToast.error(t("detail.uploadError") + ": " + uploadError.message);
        }
      }
    }

    if (taskData) {
      notifyTelegramNewTask({ taskId: taskData.id, appUrl: window.location.origin });
    }

    toast({ title: t("task.created") });

    setTitle(""); setDescription(""); setUserId(""); setPriority("medium"); setDirection(""); setComplexity(""); setTaskCode("#"); setBoard(defaultBoard); setFiles([]); setBuyerId("");
    setOpen(false);
    onCreated();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> {t("task.new")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("task.create")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-code">{t("task.code")}</Label>
            <Input
              id="task-code"
              value={taskCode}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setTaskCode(digits ? "#" + digits : "#");
              }}
              inputMode="numeric"
              pattern="#[0-9]+"
              placeholder="#9356"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-title">{t("task.title")}</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("task.titlePlaceholder")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">{t("task.description")}</Label>
            <RichTextEditor id="task-desc" ref={editorRef} value={description} onChange={setDescription} onPaste={handleDescPaste} placeholder={t("task.descOptional") + " (Ctrl+V для вставки изображений)"} rows={5} />
          </div>
          <div className="space-y-2">
            <Label>{t("task.board")}</Label>
            <Select value={board} onValueChange={setBoard}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>{lang === "ru" ? b.name_ru : b.name_en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("task.priority")}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("task.low")}</SelectItem>
                <SelectItem value="medium">{t("task.medium")}</SelectItem>
                <SelectItem value="high">{t("task.high")}</SelectItem>
                <SelectItem value="urgent">{t("task.urgent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("task.direction")}</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue placeholder={t("task.selectDirection")} /></SelectTrigger>
              <SelectContent>
                {directionsList.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t("task.complexity")}</Label>
            <Select value={complexity} onValueChange={setComplexity}>
              <SelectTrigger><SelectValue placeholder={t("task.complexity")} /></SelectTrigger>
              <SelectContent>
              {[0.25,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,6,7,8,9,10,11,12,16,24,32,40,48,56,64].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n === 0.25 ? `15${t("task.minutes")}` : n % 1 === 0 ? `${n}${t("task.hours")}` : `${Math.floor(n)}${t("task.hours")} 30${t("task.minutes")}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Исполнитель (Дизайнер)</Label>
            <Select value={userId} onValueChange={setUserId} required>
              <SelectTrigger><SelectValue placeholder={t("task.selectUser")} /></SelectTrigger>
              <SelectContent>
                {users?.filter((u) => !buyers.some((b) => b.id === u.id)).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email || u.id.slice(0, 8)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Баер (кто создал задачу)</Label>
            <Select value={buyerId || "none"} onValueChange={(v) => setBuyerId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={buyers.length === 0 ? "Нет баеров — добавьте в Пользователях" : "Выберите баера"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— без баера —</SelectItem>
                {buyers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name || b.email || b.id.slice(0, 8)}{buyerRealNames[b.id] ? ` (${buyerRealNames[b.id]})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("task.attachFile")}</Label>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])} />
              <Button variant="outline" size="sm" type="button" className="gap-1.5" asChild>
                <span><Paperclip className="h-3.5 w-3.5" />{files.length > 0 ? `${files.length} файл(ов)` : t("task.selectFile")}</span>
              </Button>
            </label>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("task.creating") : t("task.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
