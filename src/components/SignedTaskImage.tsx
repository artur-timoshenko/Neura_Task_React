import React from "react";
import { useSignedTaskFileUrl } from "@/lib/taskFileUrl";

/** Renders an image stored in the private task-files bucket via a short-lived signed URL. */
export function SignedTaskImage({
  source,
  alt,
  className,
}: {
  source: string;
  alt: string;
  className?: string;
}) {
  const url = useSignedTaskFileUrl(source);
  if (!url) return <div className={`${className ?? ""} bg-muted animate-pulse h-24`} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block mb-1">
      <img src={url} alt={alt} className={className} />
    </a>
  );
}
