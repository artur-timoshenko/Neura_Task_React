import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const QUERY_KEY = ["site_settings", "company_logo"] as const;

async function fetchLogo(): Promise<string | null> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "company_logo")
    .maybeSingle();
  return data?.value || null;
}

export function useCompanyLogo() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchLogo,
    staleTime: 5 * 60_000,
  });

  return {
    logoUrl: data ?? null,
    loading: isLoading,
    refetch: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  };
}
