import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SETTINGS_KEY = "task_directions";
const QUERY_KEY = ["site_settings", SETTINGS_KEY] as const;
const DEFAULT_DIRECTIONS = ["Крипто", "Техноскарб", "Маркетинг", "Разработка", "Дизайн"];

async function fetchDirections(): Promise<string[]> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (!data?.value) return DEFAULT_DIRECTIONS;
  try {
    const parsed = JSON.parse(data.value);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* fall through */
  }
  return DEFAULT_DIRECTIONS;
}

export function useDirections() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchDirections,
    staleTime: 5 * 60_000,
  });

  const save = async (newDirections: string[]) => {
    const value = JSON.stringify(newDirections);
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("site_settings")
        .update({ value, updated_at: new Date().toISOString() } as any)
        .eq("key", SETTINGS_KEY);
    } else {
      await supabase.from("site_settings").insert({ key: SETTINGS_KEY, value } as any);
    }
    qc.setQueryData(QUERY_KEY, newDirections);
  };

  return {
    directions: data ?? DEFAULT_DIRECTIONS,
    loading: isLoading,
    save,
    refetch: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  };
}
