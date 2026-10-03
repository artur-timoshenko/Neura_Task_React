import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Folder, Plus, Trash2, GripVertical } from "lucide-react";

interface DirectionsManagerProps {
  directions: string[];
  onSave: (directions: string[]) => Promise<void>;
}

export function DirectionsManager({ directions, onSave }: DirectionsManagerProps) {
  const { t } = useLanguage();
  const [items, setItems] = useState<string[]>(directions);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(directions); }, [directions]);

  const handleAdd = () => {
    const val = newItem.trim();
    if (!val) return;
    if (items.includes(val)) { toast.error(t("settings.directionExists")); return; }
    setItems([...items, val]);
    setNewItem("");
  };

  const handleRemove = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (items.length === 0) { toast.error(t("settings.directionMinOne")); return; }
    setSaving(true);
    await onSave(items);
    toast.success(t("settings.directionsSaved"));
    setSaving(false);
  };

  const hasChanges = JSON.stringify(items) !== JSON.stringify(directions);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Folder className="h-5 w-5" /> {t("settings.directionsTitle")}</CardTitle>
        <CardDescription>{t("settings.directionsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium px-3 py-1.5 rounded-md border border-border bg-muted/30">{item}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleRemove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={t("settings.newDirection")}
            className="flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
          <Button variant="outline" size="sm" onClick={handleAdd} disabled={!newItem.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
            {saving ? "..." : t("settings.saveDirections")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
