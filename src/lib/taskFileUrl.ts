import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TTL_SECONDS = 60 * 60; // 1 hour
const cache = new Map<string, { url: string; expiresAt: number }>();

/** Accepts a storage path or a legacy public URL and returns the object path inside the bucket. */
export function toTaskFilePath(input?: string | null): string | null {
  if (!input) return null;
  if (!/^https?:\/\//i.test(input)) return input.replace(/^\/+/, "");
  const match = input.match(/\/task-files\/(.+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1].split("?")[0]);
}

/** Creates (and caches) a short-lived signed URL for a private task-files object. */
export async function getSignedTaskFileUrl(
  input?: string | null,
  opts?: { download?: string }
): Promise<string> {
  const path = toTaskFilePath(input);
  if (!path) return "";
  const key = `${path}::${opts?.download ?? ""}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = path.startsWith("railway/")
    ? await supabase.functions.invoke("sign-task-file", {
        body: { filePath: path, download: opts?.download },
      })
    : await supabase.storage
        .from("task-files")
        .createSignedUrl(path, TTL_SECONDS, opts?.download ? { download: opts.download } : undefined);
  if (error || !data?.signedUrl) return "";
  cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + (TTL_SECONDS - 300) * 1000 });
  return data.signedUrl;
}

/** Resolves many task-file paths/URLs to signed URLs, keyed by the original input. */
export function useSignedTaskFileUrls(inputs: (string | null | undefined)[]): Record<string, string> {
  const key = inputs.filter(Boolean).join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split("|") : [];
    if (list.length === 0) {
      setUrls({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        list.map(async (i) => [i, await getSignedTaskFileUrl(i)] as const)
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return urls;
}

/** Resolves a single task-file path/URL to a signed URL. */
export function useSignedTaskFileUrl(input?: string | null): string {
  const map = useSignedTaskFileUrls([input]);
  return input ? map[input] ?? "" : "";
}
