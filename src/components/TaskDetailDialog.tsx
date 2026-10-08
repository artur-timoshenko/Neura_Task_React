import { useSignedTaskFileUrls, getSignedTaskFileUrl } from "@/lib/taskFileUrl";
import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/RichTextEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useDirections } from "@/hooks/useDirections";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Paperclip, Send, Download, ArrowUpCircle, ArrowDownCircle, AlertCircle, Flame, Folder, Calendar, Clock, Trash2, Pencil, Save, X, Timer, Upload, Video, Pause, Play, ChevronDown, RotateCcw, Copy, Check } from "lucide-react";
import { notifyTelegramReview, notifyTelegramCorrections, notifyTelegramNewTask } from "@/lib/notifyTelegram";
import { Progress } from "@/components/ui/progress";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Linkify } from "@/components/Linkify";
import { RichDescription } from "@/components/RichDescription";
import { useImagePaste } from "@/hooks/useImagePaste";
import { format, formatDistanceToNow } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import { logAction } from "@/lib/actionLog";
import { workingElapsedMs } from "@/lib/workingTime";
import { TaskChatPanel } from "@/components/TaskChatPanel";
import { User as UserIcon } from "lucide-react";
import * as tus from "tus-js-client";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];

interface Comment { id: string; task_id: string; user_id: string; content: string; created_at: string; }
interface Attachment { id: string; task_id: string; user_id: string; file_name: string; file_path: string; file_size: number | null; created_at: string; }

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeName?: string;
  onDeleted?: () => void;
  onUpdated?: () => void;
  users?: Profile[];
}

export function TaskDetailDialog({ task, open, onOpenChange, assigneeName, onDeleted, onUpdated, users }: TaskDetailDialogProps) {
  const { user, role, profile } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === "admin" || role === "teamlead";
  const [descCopied, setDescCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null);
  const [deletingAttachment, setDeletingAttachment] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submissions, setSubmissions] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSubmission, setUploadingSubmission] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [draggingOver, setDraggingOver] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [iosLinks, setIosLinks] = useState<{ href: string; fileName: string }[]>([]);

  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [buyerProfile, setBuyerProfile] = useState<{ id: string; name: string | null; email: string | null } | null>(null);
  const [buyerRealName, setBuyerRealName] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || "");
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editStatus, setEditStatus] = useState<TaskStatus>(task.status);
  const [editDirection, setEditDirection] = useState(task.direction || "");
  const [editComplexity, setEditComplexity] = useState(String((task as any).complexity || ""));
  const [editUserId, setEditUserId] = useState(task.user_id);
  const [editBuyerId, setEditBuyerId] = useState<string>((task as any).buyer_id || "");
  const [buyers, setBuyers] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [buyerRealNames, setBuyerRealNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const editDescriptionRef = useRef(task.description || "");
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const editDescRef = useRef<HTMLTextAreaElement>(null);
  const editEditorRef = useRef<RichTextEditorHandle>(null);
  useEffect(() => { editDescRef.current = editEditorRef.current?.textarea ?? null; });
  const updateEditDescription = useCallback((value: string) => {
    editDescriptionRef.current = value;
    setEditDescription(value);
    setDescriptionDirty(true);
  }, []);
  const getEditDesc = useCallback(() => editDescriptionRef.current, []);
  const handleEditDescPaste = useImagePaste(getEditDesc, updateEditDescription, editDescRef);

  // Kanban rows load the description separately after opening the dialog.
  // Accept that late value only while the editor is idle so a background
  // refresh can never erase text currently being typed.
  useEffect(() => {
    if (editing || task.description === undefined) return;
    const description = task.description || "";
    setEditDescription(description);
    editDescriptionRef.current = description;
    setDescriptionDirty(false);
  }, [task.description, editing]);

  useEffect(() => {
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    editDescriptionRef.current = task.description || "";
    setDescriptionDirty(false);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDirection(task.direction || "");
    setEditComplexity(String((task as any).complexity || ""));
    setEditUserId(task.user_id);
    setEditBuyerId((task as any).buyer_id || "");
    setEditing(false);
  }, [task.id, open]);

  // Load buyers for admins/teamleads to reassign the buyer
  useEffect(() => {
    if (!open || !isAdmin) return;
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "buyer" as any);
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) { setBuyers([]); return; }
      const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", ids);
      setBuyers(profs || []);
      const { data: names } = await (supabase as any).from("buyer_real_names").select("buyer_id, real_name").in("buyer_id", ids);
      const map: Record<string, string> = {};
      (names || []).forEach((n: any) => { map[n.buyer_id] = n.real_name; });
      setBuyerRealNames(map);
    })();
  }, [open, isAdmin]);

  // Only designers (non-buyers) can be assignees
  const buyerIdSet = new Set(buyers.map((b) => b.id));
  const assignableUsers = (users || []).filter((u) => !buyerIdSet.has(u.id));

  const priorityConfig = {
    low: { label: t("task.low"), icon: ArrowDownCircle, className: "text-muted-foreground" },
    medium: { label: t("task.medium"), icon: AlertCircle, className: "text-status-in-progress" },
    high: { label: t("task.high"), icon: ArrowUpCircle, className: "text-status-review" },
    urgent: { label: t("task.urgent"), icon: Flame, className: "text-destructive" },
  };

  const { directions } = useDirections();

  const fetchProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const uniqueIds = [...new Set(userIds)];
    const { data } = await supabase.from("profiles").select("id, name, email").in("id", uniqueIds);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p) => { map[p.id] = p.name || p.email || p.id.slice(0, 8); });
      setProfileMap((prev) => ({ ...prev, ...map }));
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase.from("task_comments").select("*").eq("task_id", task.id).order("created_at", { ascending: true });
    if (data) { setComments(data as Comment[]); fetchProfiles((data as Comment[]).map((c) => c.user_id)); }
  };

  const fetchAttachments = async () => {
    const { data } = await supabase.from("task_attachments").select("*").eq("task_id", task.id).order("created_at", { ascending: false });
    if (data) {
      setAttachments((data as any[]).filter((a: any) => (a.category || 'attachment') === 'attachment') as Attachment[]);
      setSubmissions((data as any[]).filter((a: any) => a.category === 'submission') as Attachment[]);
    }
  };

  useEffect(() => {
    if (open) {
      fetchComments(); fetchAttachments();
      const bid = (task as any).buyer_id as string | null;
      if (bid) {
        supabase.from("profiles").select("id, name, email").eq("id", bid).maybeSingle().then(({ data }) => {
          setBuyerProfile(data ?? null);
        });
        if (isAdmin) {
          (supabase as any).from("buyer_real_names").select("real_name").eq("buyer_id", bid).maybeSingle().then(({ data }: any) => {
            setBuyerRealName(data?.real_name || null);
          });
        } else {
          setBuyerRealName(null);
        }
      } else {
        setBuyerProfile(null);
        setBuyerRealName(null);
      }
      const channel = supabase.channel(`comments-${task.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_comments", filter: `task_id=eq.${task.id}` }, () => fetchComments())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [open, task.id]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("task_comments").insert({ task_id: task.id, user_id: user.id, content: newComment.trim() } as any);
    if (error) { toast.error(t("detail.sendError") + ": " + error.message); } else {
      await logAction({ action: "created", entityType: "comment", taskId: task.id, targetUserId: task.user_id, details: { content: newComment.trim() } });
      setNewComment(""); fetchComments();
    }
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${task.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("task-files").upload(filePath, file);
      if (uploadError) { toast.error(t("detail.uploadError") + ": " + uploadError.message); continue; }
      const { error: dbError } = await supabase.from("task_attachments").insert({ task_id: task.id, user_id: user.id, file_name: file.name, file_path: filePath, file_size: file.size } as any);
      if (dbError) { toast.error(t("detail.saveError") + ": " + dbError.message); }
      else {
        await logAction({ action: "uploaded", entityType: "attachment", taskId: task.id, targetUserId: task.user_id, details: { fileName: file.name, fileSize: file.size, category: "attachment" } });
      }
    }
    toast.success(t("detail.fileUploaded"));
    fetchAttachments();
    setUploading(false);
    e.target.value = "";
  };

  const signedFileUrls = useSignedTaskFileUrls([
    ...attachments.map((a: any) => a.file_path),
    ...submissions.map((s: any) => s.file_path),
  ]);

  const getFileUrl = (path: string) => signedFileUrls[path] ?? "";

  const getDownloadUrl = (path: string, fileName: string) =>
    getSignedTaskFileUrl(path, { download: fileName });

  const uploadSubmissionFiles = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0 || !user) return;
    setUploadingSubmission(true);
    const progress: Record<string, number> = {};
    filesToUpload.forEach(f => { progress[f.name] = 0; });
    setUploadProgress({ ...progress });

    let completed = 0;
    try {
      for (const file of filesToUpload) {
        try {
          const { data: uploadGrant, error: grantError } = await supabase.functions.invoke("create-task-upload", {
            body: { taskId: task.id, fileName: file.name, fileSize: file.size },
          });
          if (grantError || !uploadGrant?.resumableUrl || !uploadGrant?.path || !uploadGrant?.uploadToken) {
            throw new Error(uploadGrant?.error || grantError?.message || "Не удалось подготовить загрузку");
          }

          await new Promise<void>((resolve, reject) => {
            const upload = new tus.Upload(file, {
              endpoint: uploadGrant.resumableUrl,
              chunkSize: 6 * 1024 * 1024,
              retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
              uploadDataDuringCreation: true,
              removeFingerprintOnSuccess: true,
              headers: {
                "x-signature": uploadGrant.uploadToken,
                "x-upsert": "false",
              },
              metadata: {
                bucketName: "task-files",
                objectName: uploadGrant.path,
                contentType: file.type || "application/octet-stream",
                cacheControl: "3600",
              },
              onError: reject,
              onProgress: (bytesUploaded, bytesTotal) => {
                setUploadProgress((previous) => ({
                  ...previous,
                  [file.name]: Math.round((bytesUploaded / bytesTotal) * 100),
                }));
              },
              onSuccess: () => resolve(),
            });
            upload.start();
          });

          const { error: insertError } = await supabase.from("task_attachments").insert({
            task_id: task.id,
            user_id: user.id,
            file_name: file.name,
            file_path: uploadGrant.path,
            file_size: file.size,
            category: "submission",
          } as any);
          if (insertError) {
            await supabase.storage.from("task-files").remove([uploadGrant.path]);
            throw insertError;
          }

          completed += 1;
          await logAction({ action: "uploaded", entityType: "attachment", taskId: task.id, targetUserId: task.user_id, details: { fileName: file.name, fileSize: file.size, category: "submission" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Неизвестная ошибка";
          toast.error(`${t("detail.uploadError")}: ${file.name}. ${message}`);
        }
      }

      if (completed > 0) toast.success(`${t("detail.videosUploaded")}: ${completed}/${filesToUpload.length}`);
      await fetchAttachments();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      toast.error(`${t("detail.uploadError")}: ${message}`);
    } finally {
      setUploadProgress({});
      setUploadingSubmission(false);
    }
  };

  const triggerBrowserDownload = (href: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadOne = async (filePath: string, fileName: string) => {
    const href = await getDownloadUrl(filePath, fileName);
    if (!href) return false;
    triggerBrowserDownload(href, fileName);
    return true;
  };

  const isIosSafari = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return iosDevice && isSafari;
  };

  const handleDownloadSeparately = async () => {
    if (submissions.length === 0) return;

    // iOS Safari only permits downloads tied directly to the original tap.
    // Reserve one browsing context per file synchronously, then navigate each
    // context once its signed download URL is ready.
    if (isIosSafari()) {
      const downloadWindows = submissions.map(() => window.open("about:blank", "_blank"));
      setZipping(true);
      try {
        const links = await Promise.all(
          submissions.map(async (submission) => ({
            href: await getDownloadUrl(submission.file_path, submission.file_name),
            fileName: submission.file_name,
          }))
        );
        const ready = links.filter((item): item is { href: string; fileName: string } => Boolean(item.href));
        if (ready.length === 0) throw new Error("No download URLs");
        const blockedLinks: { href: string; fileName: string }[] = [];
        links.forEach(({ href, fileName }, index) => {
          const downloadWindow = downloadWindows[index];
          if (!href) {
            downloadWindow?.close();
            return;
          }
          if (!downloadWindow) {
            blockedLinks.push({ href, fileName });
            return;
          }
          downloadWindow.location.replace(href);
        });
        setIosLinks(blockedLinks);
        if (blockedLinks.length > 0) toast.error("Safari заблокировал часть загрузок — нажмите ссылки ниже");
        toast.success(`${ready.length} / ${submissions.length}`);
      } catch {
        downloadWindows.forEach((downloadWindow) => downloadWindow?.close());
        toast.error("Не удалось подготовить файлы");
      } finally {
        setZipping(false);
      }
      return;
    }



    setZipping(true);
    try {
      const browserWindow = window as typeof window & {
        showDirectoryPicker?: () => Promise<{
          getFileHandle: (name: string, options: { create: boolean }) => Promise<{
            createWritable: () => Promise<WritableStream>;
          }>;
        }>;
      };

      if (browserWindow.showDirectoryPicker) {
        try {
          const directory = await browserWindow.showDirectoryPicker();
          let completed = 0;

          for (const submission of submissions) {
            const href = await getDownloadUrl(submission.file_path, submission.file_name);
            if (!href) throw new Error(`No download URL for ${submission.file_name}`);

            const response = await fetch(href);
            if (!response.ok || !response.body) throw new Error(`Download failed: ${submission.file_name}`);

            const safeName = submission.file_name.replace(/[\\/:*?"<>|]/g, "_");
            const fileHandle = await directory.getFileHandle(safeName, { create: true });
            const writable = await fileHandle.createWritable();
            await response.body.pipeTo(writable);
            completed += 1;
          }

          toast.success(`${completed} / ${submissions.length}`);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // Embedded previews can expose the picker but deny its use. Fall back
          // to regular browser downloads instead of aborting the whole queue.
        }
      }

      const downloads = await Promise.all(
        submissions.map(async (submission) => ({
          href: await getDownloadUrl(submission.file_path, submission.file_name),
          fileName: submission.file_name,
        }))
      );
      const readyDownloads = downloads.filter((item) => item.href);
      if (readyDownloads.length !== submissions.length) throw new Error("Some download URLs are unavailable");

      // A separate hidden frame per response keeps every navigation alive;
      // reusing one anchor/frame causes Chrome to cancel all but the first.
      readyDownloads.forEach(({ href }, index) => {
        window.setTimeout(() => {
          const frame = document.createElement("iframe");
          frame.hidden = true;
          frame.src = href;
          document.body.appendChild(frame);
          window.setTimeout(() => frame.remove(), 60_000);
        }, index * 250);
      });
      toast.success(`${readyDownloads.length} / ${submissions.length}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Не удалось скачать все файлы");
    } finally {
      setZipping(false);
    }
  };


  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const latestDescription = editDescriptionRef.current.trim();
    const updates: Database["public"]["Tables"]["tasks"]["Update"] = {
      title: editTitle.trim(),
      priority: editPriority,
      status: editStatus,
      direction: editDirection || null,
      complexity: editComplexity ? parseFloat(editComplexity) : null,
      user_id: editUserId,
      ...(isAdmin ? { buyer_id: editBuyerId || null } : {}),
      ...(descriptionDirty ? { description: latestDescription || null } : {}),
    };
    if (editStatus === "in_progress" && !task.in_progress_at) {
      updates.in_progress_at = new Date().toISOString();
    }
    const movingToDone = (editStatus === "review" || editStatus === "done") && task.status !== "review" && task.status !== "done";
    if (movingToDone) {
      updates.completed_at = new Date().toISOString();
      // Close active pause so completion time excludes the pause window
      if ((task as any).paused_at) {
        const addMs = Date.now() - new Date((task as any).paused_at).getTime();
        updates.paused_total_ms = Number((task as any).paused_total_ms || 0) + Math.max(0, addMs);
        updates.paused_at = null;
      }
    }
    // If moving back from review/done, clear completed_at
    if (editStatus !== "review" && editStatus !== "done") updates.completed_at = null;
    const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
    setSaving(false);
    if (error) {
      toast.error(t("detail.updateError") + ": " + error.message);
    } else {
      await logAction({
        action: "updated",
        entityType: "task",
        entityId: task.id,
        taskId: task.id,
        targetUserId: editUserId,
        details: {
          title: editTitle.trim(),
          description: descriptionDirty ? latestDescription || null : task.description,
          priority: editPriority,
          status: editStatus,
          direction: editDirection || null,
          complexity: editComplexity ? parseFloat(editComplexity) : null,
          assigneeId: editUserId,
        },
      });
      if (editUserId && editUserId !== task.user_id) {
        notifyTelegramNewTask({ taskId: task.id, appUrl: window.location.origin });
      }
      if (editStatus === "corrections" && task.status !== "corrections") {
        notifyTelegramCorrections({
          taskId: task.id,
          taskCode: task.task_code || task.id.slice(0, 8),
          taskTitle: editTitle.trim() || task.title,
          designerName: assigneeName || null,
          actorName: profile?.name || user?.email || null,
          appUrl: window.location.origin,
        });
      }
      toast.success(t("detail.taskUpdated"));
      setDescriptionDirty(false);
      setEditing(false);
      onUpdated?.();
    }
  };

  const beginEditing = () => {
    if (task.description === undefined) {
      toast.error("Описание задачи ещё загружается. Попробуйте через секунду.");
      return;
    }
    const description = task.description || "";
    setEditTitle(task.title);
    setEditDescription(description);
    editDescriptionRef.current = description;
    setDescriptionDirty(false);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDirection(task.direction || "");
    setEditComplexity(String((task as any).complexity || ""));
    setEditUserId(task.user_id);
    setEditBuyerId((task as any).buyer_id || "");
    setEditing(true);
  };

  const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}ч ${m}м ${s}с`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
  };

  const formatDurationLive = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const formatDurationWords = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h} ${h === 1 ? "час" : h < 5 ? "часа" : "часов"}`);
    if (m > 0) parts.push(`${m} ${m === 1 ? "минута" : m < 5 ? "минуты" : "минут"}`);
    if (s > 0 || parts.length === 0) parts.push(`${s} ${s === 1 ? "секунда" : s < 5 ? "секунды" : "секунд"}`);
    return parts.join(" ");
  };

  const formatDurationPrecise = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}ч ${m}м ${s}с`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
  };

  const getCompletionDuration = () => {
    const inProgressAt = (task as any).in_progress_at;
    const completedAt = (task as any).completed_at;
    if (!inProgressAt || !completedAt) return null;
    const pausedTotal = Number((task as any).paused_total_ms || 0);
    const ms = workingElapsedMs(new Date(inProgressAt).getTime(), new Date(completedAt).getTime()) - pausedTotal;
    return ms > 0 ? formatDurationPrecise(ms) : null;
  };

  const completionDuration = getCompletionDuration();

  // Live timer for active task
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    // Only tick while the timer is actually running — a paused task needs no re-renders.
    if (task.status !== "in_progress" || (task as any).paused_at) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [task.status, task.id, (task as any).paused_at]);

  const isPaused = !!(task as any).paused_at;
  const liveElapsedMs = (() => {
    if (!task.in_progress_at) return 0;
    const pausedTotal = Number((task as any).paused_total_ms || 0);
    const endRef = isPaused ? new Date((task as any).paused_at).getTime() : now;
    return workingElapsedMs(new Date(task.in_progress_at).getTime(), endRef) - pausedTotal;
  })();

  const handlePauseTimer = async () => {
    if (!isAdmin || isPaused) return;
    const { error } = await supabase.from("tasks").update({ paused_at: new Date().toISOString() } as any).eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: "timer_paused", entityType: "task", entityId: task.id, taskId: task.id, targetUserId: task.user_id });
    toast.success(t("detail.timerPaused") || "Таймер на паузе");
    onUpdated?.();
  };

  const handleResumeTimer = async () => {
    if (!isAdmin || !isPaused) return;
    const pausedAt = new Date((task as any).paused_at).getTime();
    const addMs = Date.now() - pausedAt;
    const newTotal = Number((task as any).paused_total_ms || 0) + Math.max(0, addMs);
    const { error } = await supabase.from("tasks").update({ paused_at: null, paused_total_ms: newTotal } as any).eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: "timer_resumed", entityType: "task", entityId: task.id, taskId: task.id, targetUserId: task.user_id });
    toast.success(t("detail.timerResumed") || "Таймер возобновлён");
    onUpdated?.();
  };

  const handleResetTimer = async () => {
    if (!isAdmin) return;
    if (!confirm("Сбросить время выполнения задачи?")) return;
    const { error } = await supabase
      .from("tasks")
      .update({ in_progress_at: task.status === "in_progress" ? new Date().toISOString() : null, paused_at: null, paused_total_ms: 0 } as any)
      .eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    await logAction({ action: "timer_reset", entityType: "task", entityId: task.id, taskId: task.id, targetUserId: task.user_id });
    toast.success("Таймер сброшен");
    onUpdated?.();
  };

  const handleQuickStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;
    if (newStatus === "done" && !isAdmin) {
      toast.error("Только админ может перевести задачу в Done");
      return;
    }
    const updates: Database["public"]["Tables"]["tasks"]["Update"] = { status: newStatus };
    if (newStatus === "in_progress" && !task.in_progress_at) {
      updates.in_progress_at = new Date().toISOString();
    }
    if (newStatus === "review" || newStatus === "done") {
      if (!task.completed_at) updates.completed_at = new Date().toISOString();
      if ((task as any).paused_at) {
        const addMs = Date.now() - new Date((task as any).paused_at).getTime();
        updates.paused_total_ms = Number((task as any).paused_total_ms || 0) + Math.max(0, addMs);
        updates.paused_at = null;
      }
    }
    if (newStatus !== "review" && newStatus !== "done") updates.completed_at = null;

    const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction({
      action: "status_changed",
      entityType: "task",
      entityId: task.id,
      taskId: task.id,
      targetUserId: task.user_id,
      details: { from: task.status, to: newStatus },
    });

    if (newStatus === "review") {
      notifyTelegramReview({
        taskId: task.id,
        taskCode: task.task_code || task.id.slice(0, 8),
        taskTitle: task.title,
        userName: profile?.name || user?.email || "Unknown",
        appUrl: window.location.origin,
      }).catch(console.error);
    }

    if (newStatus === "corrections") {
      notifyTelegramCorrections({
        taskId: task.id,
        taskCode: task.task_code || task.id.slice(0, 8),
        taskTitle: task.title,
        designerName: assigneeName || null,
        actorName: profile?.name || user?.email || null,
        appUrl: window.location.origin,
      });
    }

    toast.success("Статус обновлён");
    onUpdated?.();
  };

  const handleDeleteAttachment = async () => {
    if (!attachmentToDelete) return;
    setDeletingAttachment(true);
    const { error: storageError } = await supabase.storage.from("task-files").remove([attachmentToDelete.file_path]);
    if (storageError) {
      setDeletingAttachment(false);
      toast.error(t("detail.deleteError") + ": " + storageError.message);
      return;
    }
    const { error: dbError } = await supabase.from("task_attachments").delete().eq("id", attachmentToDelete.id);
    setDeletingAttachment(false);
    if (dbError) {
      toast.error(t("detail.deleteError") + ": " + dbError.message);
      return;
    }
    await logAction({ action: "deleted", entityType: "attachment", entityId: attachmentToDelete.id, taskId: task.id, targetUserId: task.user_id, details: { fileName: attachmentToDelete.file_name, category: attachmentToDelete.file_path.includes("/submissions/") ? "submission" : "attachment" } });
    toast.success(t("detail.fileDeleted"));
    setAttachmentToDelete(null);
    fetchAttachments();
  };

  const pConfig = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const PriorityIcon = pConfig.icon;

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { setLightbox(null); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl w-[calc(100vw-16px)] sm:w-[90vw] max-h-[90vh] overflow-y-auto overflow-x-hidden break-words p-3 sm:p-6">
        <DialogHeader className="pt-5 sm:pt-0 min-w-0">
          <div className="min-w-0">
            {task.task_code && <div className="text-[10px] sm:text-xs text-primary font-mono break-all leading-tight mb-1">{task.task_code}</div>}
            {editing ? (
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm sm:text-lg font-semibold" />
            ) : (
              <DialogTitle className="text-sm sm:text-lg leading-tight break-words whitespace-normal pr-8">{task.title}</DialogTitle>
            )}
          </div>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Status & priority row */}
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">{t("task.priority")}</Label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as TaskPriority)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.task_priority.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">{priorityConfig[p]?.label || p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Статус</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskStatus)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.task_status.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">{t("task.direction")}</Label>
                <Select value={editDirection || "none"} onValueChange={(v) => setEditDirection(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">—</SelectItem>
                    {directions.map((d) => (
                      <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">{t("task.complexity")}</Label>
                <Select value={editComplexity || "none"} onValueChange={(v) => setEditComplexity(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">—</SelectItem>
                    {[0.25,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,6,7,8,9,10,11,12,16,24,32,40,48,56,64].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">{n === 0.25 ? `15${t("task.minutes")}` : n % 1 === 0 ? `${n}${t("task.hours")}` : `${Math.floor(n)}${t("task.hours")} 30${t("task.minutes")}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {assignableUsers.length > 0 && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">{t("task.reassign")}</Label>
                  <Select value={editUserId} onValueChange={setEditUserId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">{u.name || u.email || u.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isAdmin && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1 block">Баер (кто создал задачу)</Label>
                  <Select value={editBuyerId || "none"} onValueChange={(v) => setEditBuyerId(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">—</SelectItem>
                      {buyers.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name || b.email || b.id.slice(0, 8)}{buyerRealNames[b.id] ? ` (${buyerRealNames[b.id]})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Select value={task.status} onValueChange={(v) => handleQuickStatusChange(v as TaskStatus)}>
                <SelectTrigger
                  aria-label="Изменить статус"
                  className="h-auto w-auto gap-1 px-2 py-0.5 rounded-full border-transparent bg-transparent hover:bg-muted/60 focus:ring-1 focus:ring-ring focus:ring-offset-0 [&>svg]:hidden"
                >
                  <span className="inline-flex items-center gap-1">
                    <StatusBadge status={task.status} />
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.task_status.map((s) => {
                    const labelKey =
                      s === "todo" ? "kanban.todo" :
                      s === "in_progress" ? "kanban.inProgress" :
                      s === "review" ? "kanban.review" :
                      s === "corrections" ? "kanban.corrections" : "kanban.done";
                    const disabled = s === "done" && !isAdmin;
                    return (
                      <SelectItem key={s} value={s} disabled={disabled} className="text-xs">
                        <span className="inline-flex items-center gap-2">
                          <StatusBadge status={s} />
                          <span className="text-muted-foreground">{t(labelKey as any)}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <span className={`inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium ${pConfig.className}`}>
                <PriorityIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{pConfig.label}
              </span>
              {task.direction && (<Badge variant="outline" className="gap-1 text-[10px] sm:text-xs"><Folder className="h-3 w-3" />{task.direction}</Badge>)}
              {(task as any).complexity && (<Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs"><Clock className="h-3 w-3" />~{(task as any).complexity % 1 === 0 ? `${(task as any).complexity}${t("task.hours")}` : `${Math.floor((task as any).complexity)}${t("task.hours")} 30${t("task.minutes")}`}</Badge>)}
              {assigneeName && (<span className="text-[10px] sm:text-xs text-muted-foreground">{t("detail.assigned")}: <span className="font-medium text-foreground">{assigneeName}</span></span>)}
              {buyerProfile && (
                <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs border-status-review/40 text-status-review">
                  <UserIcon className="h-3 w-3" />Баер: {buyerProfile.name || buyerProfile.email}{isAdmin && buyerRealName ? ` (${buyerRealName})` : ""}
                </Badge>
              )}
            </div>
          )}


          <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
            {isAdmin && (
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{t("detail.created")}: {format(new Date(task.created_at), "dd.MM.yyyy HH:mm")}</span>
            )}
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{t("detail.updated")}: {format(new Date(task.updated_at), "dd.MM.yyyy HH:mm")}</span>
            {task.in_progress_at && (
              <span className="inline-flex items-center gap-1 text-status-in-progress font-medium"><Timer className="h-3 w-3 sm:h-3.5 sm:w-3.5" />In Progress: {format(new Date(task.in_progress_at), "dd.MM.yyyy HH:mm")}</span>
            )}
            {task.completed_at && (task.status === "review" || task.status === "done") && (
              <span className="inline-flex items-center gap-1 text-status-review font-medium"><Timer className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{task.status === "done" ? "Done" : "Review"}: {format(new Date(task.completed_at), "dd.MM.yyyy HH:mm")}</span>
            )}
            {completionDuration && (
              <span className="inline-flex items-center gap-1 text-status-done font-medium"><Timer className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{t("detail.completionTime")}: {completionDuration}</span>
            )}
          </div>

          {/* Live timer with pause/resume (admin only, while task is in progress) */}
          {task.in_progress_at && task.status === "in_progress" && (
            <div className={`rounded-md border p-3 flex items-center justify-between gap-3 flex-wrap ${isPaused ? "border-muted bg-muted/30" : "border-status-in-progress/40 bg-status-in-progress/5"}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Timer className={`h-4 w-4 shrink-0 ${isPaused ? "text-muted-foreground" : "text-status-in-progress"}`} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {isPaused ? t("detail.paused") : t("detail.elapsed")}
                  </span>
                  <span className={`font-mono text-base sm:text-lg font-semibold tabular-nums ${isPaused ? "text-muted-foreground" : "text-foreground"}`}>
                    {formatDurationLive(liveElapsedMs)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDurationWords(liveElapsedMs)}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {isPaused ? (
                    <Button size="sm" onClick={handleResumeTimer} className="gap-1.5">
                      <Play className="h-3.5 w-3.5" />{t("detail.resume")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handlePauseTimer} className="gap-1.5">
                      <Pause className="h-3.5 w-3.5" />{t("detail.pause")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleResetTimer} className="gap-1.5" title="Сбросить таймер">
                    <RotateCcw className="h-3.5 w-3.5" />Сброс
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {editing ? (
            <div>
              <Label className="text-[10px] sm:text-xs text-muted-foreground">{t("task.description")}</Label>
              <RichTextEditor ref={editEditorRef} value={editDescription} onChange={updateEditDescription} onPaste={handleEditDescPaste} rows={6} className="mt-1" placeholder="Ctrl+V для вставки изображений" />
            </div>
          ) : (
            task.description && (
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">{t("task.description")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={async () => {
                      try {
                        const text = task.description || "";
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(text);
                        } else {
                          const ta = document.createElement("textarea");
                          ta.value = text;
                          ta.style.position = "fixed";
                          ta.style.opacity = "0";
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                        }
                        setDescCopied(true);
                        setTimeout(() => setDescCopied(false), 2000);
                      } catch {
                        toast.error(t("common.copyFailed"));
                      }
                    }}
                  >
                    {descCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {descCopied ? t("common.copied") : t("common.copy")}
                  </Button>
                </div>
                <div className="text-xs sm:text-sm mt-1 whitespace-pre-wrap break-words overflow-visible leading-relaxed font-mono"><RichDescription>{task.description}</RichDescription></div>
              </div>
            )
          )}

          {/* Admin action buttons */}
          {isAdmin && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              {editing ? (
                <>
                  <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editTitle.trim()} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" />{saving ? "..." : t("detail.saveChanges")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditing(false);
                    setEditTitle(task.title);
                    setEditDescription(task.description || "");
                    editDescriptionRef.current = task.description || "";
                    setDescriptionDirty(false);
                    setEditPriority(task.priority);
                    setEditStatus(task.status);
                    setEditDirection(task.direction || "");
                    setEditComplexity(String((task as any).complexity || ""));
                    setEditUserId(task.user_id);
                  }} className="gap-1.5">
                    <X className="h-3.5 w-3.5" />{t("detail.cancelEdit")}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={beginEditing} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />{t("detail.edit")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />{t("detail.deleteTask")}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Files - attached to task by admin */}
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
              <Label className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                {t("detail.files")} ({attachments.length})
              </Label>
              {isAdmin && (
                <label className="cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  <Button variant="outline" size="sm" className="gap-1.5" asChild disabled={uploading}>
                    <span><Paperclip className="h-3.5 w-3.5" />{uploading ? t("detail.uploading") : t("detail.attach")}</span>
                  </Button>
                </label>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attachments.map((a) => {
                  const url = getFileUrl(a.file_path);
                  const ext = a.file_name.split(".").pop()?.toLowerCase() || "";
                  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
                  const isVideo = ["mp4", "webm", "ogg", "mov", "avi"].includes(ext);

                  return (
                    <div key={a.id} className="relative group rounded-md border border-border overflow-hidden bg-muted/30">
                      {isImage && (
                        <button type="button" className="block w-full cursor-pointer" onClick={() => setLightbox({ url, type: "image" })}>
                          <img src={url} alt={a.file_name} className="w-full h-28 object-cover" loading="lazy" />
                        </button>
                      )}
                      {isVideo && (
                        <button type="button" className="block w-full cursor-pointer" onClick={() => setLightbox({ url, type: "video" })}>
                          <video src={url} className="w-full h-28 object-cover" muted preload="metadata" />
                        </button>
                      )}
                      {!isImage && !isVideo && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="w-full h-28 flex items-center justify-center">
                            <Download className="h-6 w-6 text-muted-foreground" />
                          </div>
                        </a>
                      )}
                      <div className="p-1.5 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs truncate flex-1">{a.file_name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary"
                            onClick={() => handleDownloadOne(a.file_path, a.file_name)}
                            title={t("detail.downloadAll")}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setAttachmentToDelete(a)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Video Submissions - delivered by assignee */}
          <div className="rounded-md border border-status-review/40 bg-status-review/5 p-3">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-status-review/30">
              <Label className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                <Upload className="h-3.5 w-3.5 text-status-review" />
                {t("detail.submissions")} ({submissions.length})
              </Label>
              {submissions.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleDownloadSeparately} disabled={zipping}>
                  <Download className="h-3.5 w-3.5" />
                  {zipping ? t("detail.downloadingSeparately") : t("detail.runSeparately")}
                </Button>

              )}
            </div>
            {iosLinks.length > 0 && (
              <div className="mb-2 space-y-1 border border-status-review/30 p-2">
                {iosLinks.map((item, index) => (
                  <a
                    key={item.href}
                    href={item.href}
                    download={item.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs underline"
                  >
                    <Download className="h-3 w-3" />
                    {index + 1}. {item.fileName}
                  </a>
                ))}
              </div>
            )}

            <label
              className={`relative block border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${draggingOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
              onDragLeave={() => setDraggingOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setDraggingOver(false);
                uploadSubmissionFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <input type="file" multiple className="hidden" onChange={(e) => {
                if (e.target.files) {
                  uploadSubmissionFiles(Array.from(e.target.files));
                  e.target.value = "";
                }
              }} />
              {uploadingSubmission ? (
                <div className="space-y-2 py-1">
                  {Object.entries(uploadProgress).map(([name, pct]) => (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate max-w-[70%]">{name}</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {t("detail.dragVideos")} {t("detail.selectVideos")}
                  </p>
                </div>
              )}
            </label>
            {submissions.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {submissions.map((a) => {
                  const url = getFileUrl(a.file_path);
                  const ext = a.file_name.split(".").pop()?.toLowerCase() || "";
                  const isVideo = ["mp4", "webm", "ogg", "mov", "avi", "mkv", "flv", "wmv", "m4v"].includes(ext);
                  const createdAt = new Date(a.created_at);
                  const expiresAt = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
                  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
                  return (
                    <div key={a.id} className="relative group rounded-md border border-border overflow-hidden bg-muted/30">
                      {isVideo ? (
                        <button type="button" className="block w-full cursor-pointer" onClick={() => setLightbox({ url, type: "video" })}>
                          <video src={url} className="w-full h-28 object-cover" muted preload="metadata" />
                        </button>
                      ) : (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="w-full h-28 flex items-center justify-center">
                            <Download className="h-6 w-6 text-muted-foreground" />
                          </div>
                        </a>
                      )}
                      <div className="p-1.5 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs truncate flex-1">{a.file_name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary"
                            onClick={() => handleDownloadOne(a.file_path, a.file_name)}
                            title={t("detail.downloadAll")}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {(isAdmin || a.user_id === user?.id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setAttachmentToDelete(a)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {createdAt.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <span className={`text-[10px] ${daysLeft <= 3 ? "text-destructive" : "text-muted-foreground"}`}>
                          {t("detail.expiresIn")} {daysLeft}{t("detail.days")}
                        </span>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Personal chat: Designer <-> Buyer (admin sees & can write as buyer) */}
          <TaskChatPanel
            taskId={task.id}
            taskCode={task.task_code}
            taskTitle={task.title}
            designerId={task.user_id}
            buyerId={(task as any).buyer_id ?? null}
            buyerName={buyerProfile?.name || buyerProfile?.email || null}
            designerName={assigneeName || null}
          />

          {/* Comments */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">{t("detail.comments")} ({comments.length})</Label>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
              {comments.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{t("detail.noComments")}</p>}
              {comments.map((c) => {
                const isMe = c.user_id === user?.id;
                const authorName = profileMap[c.user_id] || (isMe ? t("detail.you") : c.user_id.slice(0, 8));
                return (
                  <div key={c.id} className={`p-3 rounded-lg text-sm ${isMe ? "bg-primary/10 ml-6" : "bg-muted mr-6"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{authorName}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                        {(isMe || isAdmin) && (
                          <button
                            onClick={async () => {
                              const { error } = await supabase.from("task_comments").delete().eq("id", c.id);
                              if (!error) {
                                await logAction({ action: "deleted", entityType: "comment", entityId: c.id, taskId: task.id, targetUserId: task.user_id, details: { content: c.content } });
                                fetchComments();
                              }
                            }}
                            className="text-muted-foreground hover:text-destructive ml-1"
                            title={t("detail.deleteComment")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap"><Linkify>{c.content}</Linkify></p>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t("detail.writeComment")} rows={2} className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendComment(); }} />
              <Button size="icon" onClick={handleSendComment} disabled={sending || !newComment.trim()} className="shrink-0 self-end"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("task.deleteConfirm")}</AlertDialogTitle>
          <AlertDialogDescription>{t("task.deleteDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("users.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              setDeleting(true);
              const { error } = await supabase.from("tasks").delete().eq("id", task.id);
              setDeleting(false);
              if (error) { toast.error(t("task.deleteError")); } else {
                await logAction({ action: "deleted", entityType: "task", entityId: task.id, taskId: task.id, targetUserId: task.user_id, details: { title: task.title, taskCode: task.task_code } });
                toast.success(t("task.deleted"));
                setConfirmDelete(false);
                onOpenChange(false);
                onDeleted?.();
              }
            }}
          >
            {deleting ? "..." : t("users.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!attachmentToDelete} onOpenChange={(open) => { if (!open) setAttachmentToDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("detail.deleteFileConfirm")}</AlertDialogTitle>
          <AlertDialogDescription>{t("detail.deleteFileDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("users.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deletingAttachment}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDeleteAttachment}
          >
            {deletingAttachment ? "..." : t("detail.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Dialog open={!!lightbox} onOpenChange={(v) => { if (!v) setLightbox(null); }}>
      <DialogContent
        className="retro-outset bg-card border-border pt-10 px-0 pb-0 gap-0 w-auto max-w-[min(600px,90vw)] max-h-[85vh] overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-3 py-2 border-b border-border">
          <DialogTitle className="font-pixel text-[10px] text-muted-foreground uppercase tracking-wider">
            {lightbox?.type === "image" ? "📷 preview" : "🎬 preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center p-3 bg-muted/30">
          {lightbox?.type === "image" ? (
            <img src={lightbox.url} alt="" className="max-w-full max-h-[calc(85vh-60px)] object-contain rounded" />
          ) : lightbox?.type === "video" ? (
            <video src={lightbox.url} controls autoPlay className="max-w-full max-h-[calc(85vh-60px)] rounded" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
