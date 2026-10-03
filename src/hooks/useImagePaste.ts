import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useImagePaste(
  getText: () => string,
  setText: (val: string) => void,
  selectionRef?: React.RefObject<HTMLTextAreaElement | null>
) {
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/")) continue;

        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const ext = file.type.split("/")[1] || "png";
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Необходимо войти в систему", { id: "img-paste" });
          return;
        }
        const filePath = `description-images/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        toast.loading("Загрузка изображения...", { id: "img-paste" });

        const { error } = await supabase.storage.from("task-files").upload(filePath, file);
        if (error) {
          toast.error("Ошибка загрузки: " + error.message, { id: "img-paste" });
          return;
        }

        const { data } = supabase.storage.from("task-files").getPublicUrl(filePath);
        const markdown = `![image](${data.publicUrl})`;

        const textarea = selectionRef?.current;
        const currentText = getText();

        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText = currentText.slice(0, start) + markdown + currentText.slice(end);
          setText(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + markdown.length;
            textarea.focus();
          }, 0);
        } else {
          setText(currentText + (currentText ? "\n" : "") + markdown);
        }

        toast.success("Изображение добавлено", { id: "img-paste" });
        return;
      }
    },
    [getText, setText, selectionRef]
  );

  return handlePaste;
}
