import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export type BoardRow = {
  id: string;
  slug: string;
  name_ru: string;
  name_en: string;
  icon: string;
  sort_order: number;
};

export const FALLBACK_BOARDS: BoardRow[] = [
  { id: "motion", slug: "motion", name_ru: "Моушен", name_en: "Motion", icon: "Clapperboard", sort_order: 1 },
  { id: "sites", slug: "sites", name_ru: "Сайты", name_en: "Sites", icon: "Globe2", sort_order: 2 },
  { id: "cs2", slug: "cs2", name_ru: "CS2 Bot", name_en: "CS2 Bot", icon: "Bot", sort_order: 3 },
];

export function useBoards() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();

  const { data, isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await (supabase as any)
        .from("boards")
        .select("id,slug,name_ru,name_en,icon,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as BoardRow[];
    },
    staleTime: 5 * 60_000,
  });

  const boards = data && data.length > 0 ? data : FALLBACK_BOARDS;

  const label = (slug: string) => {
    const b = boards.find((x) => x.slug === slug);
    if (!b) return slug;
    return lang === "ru" ? b.name_ru : b.name_en;
  };

  return {
    boards,
    isLoading,
    label,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["boards"] }),
  };
}
