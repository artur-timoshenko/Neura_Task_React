import React, { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { getSignedTaskFileUrl } from "@/lib/taskFileUrl";

marked.setOptions({ gfm: true, breaks: true });

// Force every rendered link to open in a new tab
if (typeof window !== "undefined") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if ((node as Element).tagName === "A") {
      (node as Element).setAttribute("target", "_blank");
      (node as Element).setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function RichDescription({ children }: { children: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(children || "", { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ["target", "rel"],
    });
  }, [children]);

  // Images stored in the private task-files bucket need short-lived signed URLs
  const [resolvedHtml, setResolvedHtml] = useState(html);

  useEffect(() => {
    let cancelled = false;
    const matches = Array.from(new Set(html.match(/[^"'\s]+\/task-files\/[^"'\s)]+/g) ?? []));
    if (matches.length === 0) {
      setResolvedHtml(html);
      return;
    }
    setResolvedHtml(html);
    (async () => {
      let next = html;
      for (const raw of matches) {
        const signed = await getSignedTaskFileUrl(raw);
        if (signed) next = next.split(raw).join(signed);
      }
      if (!cancelled) setResolvedHtml(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none break-words [&_a]:text-primary [&_a]:underline [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_img]:my-2 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_hr]:my-3"
      dangerouslySetInnerHTML={{ __html: resolvedHtml }}
    />
  );
}
