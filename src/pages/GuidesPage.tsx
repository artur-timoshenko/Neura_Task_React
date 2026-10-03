import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { getSignedGuideFileUrl } from "@/lib/guideFileUrl";
import { toast } from "sonner";
import { BookOpen, Plus, Search, FileVideo, Loader2, Download } from "lucide-react";

interface GuideFileSummary {
  guide_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
}

function isAudio(file: GuideFileSummary) {
  return (
    (file.mime_type || "").startsWith("audio") ||
    /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i.test(file.file_name)
  );
}

export interface Guide {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function GuidesPage() {
  const { user, role } = useAuth();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();
  const ru = lang === "ru";
  const canEdit = role === "admin" || role === "teamlead";

  const [guides, setGuides] = useState<Guide[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filesMap, setFilesMap] = useState<Record<string, GuideFileSummary>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"guide" | "voices">(
    () => (new URLSearchParams(window.location.search).get("section") === "voices" ? "voices" : "guide")
  );
  const isVoices = section === "voices";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("guides")
      .select("id,title,summary,content,category,created_by,created_at,updated_at") as any)
      .eq("section", section)
      .order("updated_at", { ascending: false });
    setGuides((data as Guide[]) || []);
    const { data: files } = await supabase
      .from("guide_files")
      .select("guide_id,file_name,file_path,mime_type");
    const countMap: Record<string, number> = {};
    const fileMap: Record<string, GuideFileSummary> = {};
    (files || []).forEach((f: any) => {
      countMap[f.guide_id] = (countMap[f.guide_id] || 0) + 1;
      const summary: GuideFileSummary = f;
      // Prefer the first audio file per voice; otherwise keep the first file overall
      if (!fileMap[f.guide_id] || isAudio(summary)) {
        if (!fileMap[f.guide_id] || isAudio(summary)) {
          fileMap[f.guide_id] = summary;
        }
      }
    });
    setCounts(countMap);
    setFilesMap(fileMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [section]);

  const create = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("guides")
      .insert({ title: title.trim(), summary: summary.trim() || null, category: category.trim() || null, content, created_by: user.id, section } as any)
      .select("id")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    setTitle(""); setSummary(""); setCategory(""); setContent("");
    navigate(`/guides/${data!.id}?section=${section}`);
  };

  const filtered = guides.filter((g) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [g.title, g.summary, g.category, g.content].some((v) => (v || "").toLowerCase().includes(q));
  });

  const downloadVoice = async (file: GuideFileSummary) => {
    const href = await getSignedGuideFileUrl(file.file_path, { download: file.file_name });
    if (!href) {
      toast.error(lang === "ru" ? "Не удалось получить ссылку" : "Failed to get download link");
      return;
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = file.file_name;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <AppShell>
      <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-pixel text-[13px] md:text-[14px] flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> {t("guide.title")}
          </h1>
          {canEdit && (
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> {isVoices ? t("guide.newVoice") : t("guide.new")}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(["guide", "voices"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setSection(s); setQuery(""); }}
              className={`px-3 py-2 text-[12px] md:text-[11px] font-bold ${section === s ? "retro-inset bg-primary/20 text-primary" : "retro-outset bg-card text-muted-foreground"}`}
            >
              {s === "guide" ? t("guide.tabGuides") : t("guide.tabVoices")}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isVoices ? t("guide.searchVoices") : t("guide.search")}
            className="pl-8"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("auth.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="retro-outset bg-card p-6 text-center text-sm text-muted-foreground">
            {isVoices ? t("guide.noVoices") : t("guide.noGuides")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((g) => {
              const voiceFile = isVoices ? filesMap[g.id] : null;
              return (
                <div
                  key={g.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/guides/${g.id}?section=${section}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/guides/${g.id}?section=${section}`);
                    }
                  }}
                  className="retro-outset bg-card p-3 md:p-4 text-left hover:bg-secondary/40 transition-colors space-y-2 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-[14px] md:text-[13px] leading-snug break-words">{g.title}</h2>
                    <div className="shrink-0 flex items-center gap-1">
                      {voiceFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={t("guide.download")}
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadVoice(voiceFile);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {counts[g.id] > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <FileVideo className="h-3.5 w-3.5" /> {counts[g.id]}
                        </span>
                      )}
                    </div>
                  </div>
                  {g.summary && <p className="text-[12px] text-muted-foreground line-clamp-3">{g.summary}</p>}
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {g.category && <span className="retro-inset px-1.5 py-0.5">{g.category}</span>}
                    <span>{new Date(g.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-pixel text-[11px]">{isVoices ? t("guide.newVoice") : t("guide.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("guide.titleLabel")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("guide.category")}</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("guide.categoryPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("guide.summary")}</Label>
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("guide.content")}</Label>
              <RichTextEditor value={content} onChange={setContent} rows={10} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{ru ? "Отмена" : "Cancel"}</Button>
            <Button onClick={create} disabled={saving || !title.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {ru ? "Создать" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
