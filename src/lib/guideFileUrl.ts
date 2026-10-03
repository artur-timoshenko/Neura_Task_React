import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expiresAt: number }>();

/** Creates (and caches) a short-lived signed URL for a private guide-files object. */
export async function getSignedGuideFileUrl(
  path?: string | null,
  opts?: { download?: string }
): Promise<string> {
  if (!path) return "";
  const key = `${path}::${opts?.download ?? ""}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage
    .from("guide-files")
    .createSignedUrl(path, TTL_SECONDS, opts?.download ? { download: opts.download } : undefined);
  if (error || !data?.signedUrl) return "";
  cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + (TTL_SECONDS - 300) * 1000 });
  return data.signedUrl;
}

/** Resolves many guide-file paths to signed URLs, keyed by path. */
export function useSignedGuideFileUrls(
  paths: (string | null | undefined)[],
  opts?: { download?: string }
): Record<string, string> {
  const key = paths.filter(Boolean).join("|");
  const download = opts?.download;
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split("|") : [];
    if (list.length === 0 || list[0] === "") {
      setUrls({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        list.map(async (p) => [p, await getSignedGuideFileUrl(p, { download })] as const)
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [key, download]);

  return urls;
}
