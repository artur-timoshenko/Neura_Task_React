import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichDescription } from "@/components/RichDescription";
import { sanitizeFileName } from "@/lib/sanitizeFileName";
import { getSignedGuideFileUrl, useSignedGuideFileUrls } from "@/lib/guideFileUrl";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, Music, Pencil, Save, Trash2, Upload, X } from "lucide-react";

interface Guide {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

interface GuideFile {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  created_at: string;
}

export default function GuideDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") === "voices" ? "voices" : "guide";
  const listUrl = `/guides?section=${section}`;
  const { user, role } = useAuth();
  const { lang, t } = useLanguage();
  const ru = lang === "ru";
  const canEdit = role === "admin" || role === "teamlead";

  const [guide, setGuide] = useState<Guide | null>(null);
  const [files, setFiles] = useState<GuideFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [siblings, setSiblings] = useState<{ id: string; title: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  const urls = useSignedGuideFileUrls(files.map((f) => f.file_path));

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from("guides")
      .select("id,title,summary,content,category,created_at,updated_at")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const g = data as Guide;
      setGuide(g);
      setTitle(g.title);
      setSummary(g.summary || "");
      setCategory(g.category || "");
      setContent(g.content || "");
    }
    const { data: fl } = await supabase
      .from("guide_files")
      .select("id,file_name,file_path,mime_type,created_at")
      .eq("guide_id", id)
      .order("created_at", { ascending: true });
    setFiles((fl as GuideFile[]) || []);
    const { data: sib } = await (supabase.from("guides").select("id,title") as any)
      .eq("section", section)
      .order("updated_at", { ascending: false });
    setSiblings((sib as { id: string; title: string }[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const idx = siblings.findIndex((s) => s.id === id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const save = async () => {
    if (!guide || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("guides")
      .update({ title: title.trim(), summary: summary.trim() || null, category: category.trim() || null, content })
      .eq("id", guide.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setEditing(false);
    load();
  };

  const removeGuide = async () => {
    if (!guide) return;
    if (!window.confirm(t("guide.deleteConfirm"))) return;
    const paths = files.map((f) => f.file_path);
    if (paths.length) await supabase.storage.from("guide-files").remove(paths);
    const { error } = await supabase.from("guides").delete().eq("id", guide.id);
    if (error) { toast.error(error.message); return; }
    navigate(listUrl);
  };

  const upload = async (list: FileList | null) => {
    if (!list || !list.length || !guide || !user) return;
    setUploading(true);
    for (const file of Array.from(list)) {
      const path = `${guide.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("guide-files").upload(path, file);
      if (upErr) { toast.error(upErr.message); continue; }
      const { error: dbErr } = await supabase.from("guide_files").insert({
        guide_id: guide.id,
        user_id: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
      });
      if (dbErr) toast.error(dbErr.message);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const removeFile = async (f: GuideFile) => {
    await supabase.storage.from("guide-files").remove([f.file_path]);
    await supabase.from("guide_files").delete().eq("id", f.id);
    load();
  };

  const downloadFile = async (f: GuideFile) => {
    const href = await getSignedGuideFileUrl(f.file_path, { download: f.file_name });
    if (!href) { toast.error(ru ? "Не удалось получить ссылку" : "Failed to get download link"); return; }
    const link = document.createElement("a");
    link.href = href;
    link.download = f.file_name;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("auth.loading")}
        </div>
      </AppShell>
    );
  }

  if (!guide) {
    return (
      <AppShell>
        <div className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">{t("guide.notFound")}</p>
          <Button variant="outline" onClick={() => navigate(listUrl)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("guide.back")}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(listUrl)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> {t("guide.back")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!prev}
              onClick={() => prev && navigate(`/guides/${prev.id}?section=${section}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!next}
              onClick={() => next && navigate(`/guides/${next.id}?section=${section}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={save} disabled={saving || !title.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                    {t("guide.save")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); load(); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1.5" /> {t("guide.edit")}
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={removeGuide}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="retro-outset bg-card p-3 md:p-5 space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("guide.titleLabel")}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("guide.category")}</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("guide.summary")}</Label>
                <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("guide.content")}</Label>
                <RichTextEditor value={content} onChange={setContent} rows={14} />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="font-pixel text-[13px] md:text-[14px] leading-relaxed break-words">{guide.title}</h1>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {guide.category && <span className="retro-inset px-1.5 py-0.5">{guide.category}</span>}
                  <span>{new Date(guide.updated_at).toLocaleString()}</span>
                </div>
                {guide.summary && <p className="text-[13px] text-muted-foreground">{guide.summary}</p>}
              </div>
              <div className="text-[14px] md:text-sm">
                {guide.content?.trim()
                  ? <RichDescription>{guide.content}</RichDescription>
                  : <span className="text-muted-foreground text-sm">{t("guide.noContent")}</span>}
              </div>
            </>
          )}
        </div>

        <div className="retro-outset bg-card p-3 md:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-[13px]">{t("guide.files")}</h2>
            {canEdit && (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => upload(e.target.files)}
                />
                <input
                  ref={audioInputRef}
                  type="file"
                  multiple
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => upload(e.target.files)}
                />
                <Button size="sm" variant="outline" onClick={() => audioInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Music className="h-4 w-4 mr-1.5" />}
                  {ru ? "Аудио" : "Audio"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                  {t("guide.upload")}
                </Button>
              </div>
            )}
          </div>

          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("guide.noFiles")}</p>
          ) : (
            <div className="space-y-3">
              {files.map((f) => {
                const url = urls[f.file_path];
                const isVideo = (f.mime_type || "").startsWith("video") || /\.(mp4|webm|mov|m4v)$/i.test(f.file_name);
                const isImage = (f.mime_type || "").startsWith("image") || /\.(png|jpe?g|gif|webp)$/i.test(f.file_name);
                const isAudio = (f.mime_type || "").startsWith("audio") || /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(f.file_name);
                return (
                  <div key={f.id} className="retro-inset p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <a href={url || undefined} target="_blank" rel="noreferrer" className="text-[12px] text-primary underline break-all">
                        {f.file_name}
                      </a>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadFile(f)} title={t("guide.download")}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(f)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {url && isAudio && <audio src={url} controls preload="metadata" className="w-full" />}
                    {url && isVideo && !isAudio && <video src={url} controls preload="metadata" className="w-full max-h-[420px] bg-black" />}
                    {url && isImage && <img src={url} alt={f.file_name} className="max-w-full border border-border" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
