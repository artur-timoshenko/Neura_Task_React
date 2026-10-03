import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"'`]+?)(?=[)\].,;!?'"]*(?:\s|$)|$)/gi;

export function Linkify({ children }: { children: string }) {
  const parts = children.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 break-all">
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}
