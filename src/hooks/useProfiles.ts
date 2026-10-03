import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PROFILE_LIST_FIELDS } from "@/lib/taskFields";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const sel = (s: string): string => s;

/**
 * Shared, cached profile directory. React Query dedupes this across pages and
 * realtime re-renders (staleTime is configured globally at 60s).
 */
export function useProfiles(ids?: string[] | null, enabled = true) {
  return useQuery({
    queryKey: ["profiles", ids ? [...ids].sort().join(",") : "all"],
    enabled,
    queryFn: async () => {
      let q = supabase.from("profiles").select(sel(PROFILE_LIST_FIELDS));
      if (ids) q = q.in("id", ids);
      const { data, error } = await q.returns<Profile[]>();
      if (error) throw error;
      return data || [];
    },
  });
}

export function buildUserMap(profiles: Profile[]) {
  const m: Record<string, string> = {};
  profiles.forEach((p) => { m[p.id] = p.name || p.email || p.id.slice(0, 8); });
  return m;
}
