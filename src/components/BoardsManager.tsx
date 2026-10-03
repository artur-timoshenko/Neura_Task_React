import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBoards, type BoardRow } from "@/hooks/useBoards";
import { BOARD_ICON_NAMES, boardIcon, slugify } from "@/lib/boards";

const RESERVED = new Set([
  "auth", "reset-password", "task", "users", "settings", "stats", "projects", "chats", "guides",
]);

export function BoardsManager() {
  const { t, lang } = useLanguage();
  const { boards, refetch } = useBoards();
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [icon, setIcon] = useState("LayoutGrid");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const ru = nameRu.trim();
    const en = nameEn.trim() || ru;
    if (!ru) return;
    const slug = slugify(en) || slugify(ru);
    if (!slug) { toast.error(lang === "ru" ? "Укажите название латиницей" : "Use latin characters in the English name"); return; }
    if (RESERVED.has(slug) || boards.some((b) => b.slug === slug)) {
      toast.error(lang === "ru" ? "Такая доска уже существует" : "This board already exists");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("boards").insert({
      slug, name_ru: ru, name_en: en, icon,
      sort_order: (boards[boards.length - 1]?.sort_order ?? 0) + 1,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNameRu(""); setNameEn(""); setIcon("LayoutGrid");
    await refetch();
    toast.success(lang === "ru" ? "Доска добавлена" : "Board added");
  };

  const remove = async (b: BoardRow) => {
    const { count } = await (supabase as any)
      .from("tasks").select("id", { count: "exact", head: true }).eq("board", b.slug);
    if (count && count > 0) {
      toast.error(lang === "ru"
        ? `Нельзя удалить: в доске ${count} задач`
        : `Cannot delete: board has ${count} tasks`);
      return;
    }
    const { error } = await (supabase as any).from("boards").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    await refetch();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = boards[index];
    const b = boards[index + dir];
    if (!a || !b) return;
    await (supabase as any).from("boards").update({ sort_order: b.sort_order }).eq("id", a.id);
    await (supabase as any).from("boards").update({ sort_order: a.sort_order }).eq("id", b.id);
    await refetch();
  };

  const rename = async (b: BoardRow, patch: Partial<BoardRow>) => {
    const { error } = await (supabase as any).from("boards").update(patch).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    await refetch();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {boards.map((b, i) => {
          const Icon = boardIcon(b.icon);
          return (
            <div key={b.id} className="flex items-center gap-2 border border-border p-2">
              <Icon className="h-4 w-4 shrink-0" />
              <Input
                className="h-8 text-xs"
                defaultValue={b.name_ru}
                onBlur={(e) => e.target.value.trim() && e.target.value !== b.name_ru && rename(b, { name_ru: e.target.value.trim() })}
              />
              <Input
                className="h-8 text-xs"
                defaultValue={b.name_en}
                onBlur={(e) => e.target.value.trim() && e.target.value !== b.name_en && rename(b, { name_en: e.target.value.trim() })}
              />
              <span className="text-[10px] text-muted-foreground shrink-0">/{b.slug}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={i === boards.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => remove(b)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <Label className="text-xs">{lang === "ru" ? "Новая доска" : "New board"}</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input className="h-8 text-xs" placeholder={lang === "ru" ? "Название (RU)" : "Name (RU)"} value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
          <Input className="h-8 text-xs" placeholder={lang === "ru" ? "Название (EN)" : "Name (EN)"} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger className="h-8 text-xs sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BOARD_ICON_NAMES.map((name) => {
                const Icon = boardIcon(name);
                return (
                  <SelectItem key={name} value={name}>
                    <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {name}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" disabled={saving || !nameRu.trim()} onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {lang === "ru" ? "Добавить" : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
}
