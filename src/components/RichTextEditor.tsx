import React, { useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered,
  Quote, Code, Link as LinkIcon, Image as ImageIcon, Minus, CheckSquare, Eye, EyeOff,
} from "lucide-react";
import { RichDescription } from "./RichDescription";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
}

export interface RichTextEditorHandle {
  focus: () => void;
  textarea: HTMLTextAreaElement | null;
}

type WrapAction = { kind: "wrap"; before: string; after: string; placeholder?: string };
type LineAction = { kind: "line"; prefix: string };
type InsertAction = { kind: "insert"; text: string };
type Action = WrapAction | LineAction | InsertAction;

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ value, onChange, onPaste, placeholder, rows = 5, className, id }, ref) => {
    const taRef = useRef<HTMLTextAreaElement>(null);
    const [preview, setPreview] = React.useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => taRef.current?.focus(),
      get textarea() { return taRef.current; },
    }));

    const apply = useCallback((action: Action) => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.slice(start, end);

      let newValue = value;
      let newStart = start;
      let newEnd = end;

      if (action.kind === "wrap") {
        const text = selected || action.placeholder || "";
        const inserted = action.before + text + action.after;
        newValue = value.slice(0, start) + inserted + value.slice(end);
        newStart = start + action.before.length;
        newEnd = newStart + text.length;
      } else if (action.kind === "line") {
        // find start of current line
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = value.indexOf("\n", end);
        const sliceEnd = lineEnd === -1 ? value.length : lineEnd;
        const block = value.slice(lineStart, sliceEnd);
        const lines = block.split("\n");
        const transformed = lines
          .map((l) => (l.startsWith(action.prefix) ? l : action.prefix + l))
          .join("\n");
        newValue = value.slice(0, lineStart) + transformed + value.slice(sliceEnd);
        newStart = lineStart;
        newEnd = lineStart + transformed.length;
      } else if (action.kind === "insert") {
        newValue = value.slice(0, start) + action.text + value.slice(end);
        newStart = start + action.text.length;
        newEnd = newStart;
      }

      onChange(newValue);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newStart, newEnd);
      });
    }, [value, onChange]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); apply({ kind: "wrap", before: "**", after: "**", placeholder: "жирный" }); }
      else if (k === "i") { e.preventDefault(); apply({ kind: "wrap", before: "*", after: "*", placeholder: "курсив" }); }
      else if (k === "k") {
        e.preventDefault();
        const url = window.prompt("URL:");
        if (url) apply({ kind: "wrap", before: "[", after: `](${url})`, placeholder: "ссылка" });
      }
    };

    const insertLink = () => {
      const url = window.prompt("URL:");
      if (!url) return;
      apply({ kind: "wrap", before: "[", after: `](${url})`, placeholder: "ссылка" });
    };

    const insertImage = () => {
      const url = window.prompt("URL изображения:");
      if (!url) return;
      apply({ kind: "wrap", before: "![", after: `](${url})`, placeholder: "alt" });
    };

    const Btn = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    );

    return (
      <TooltipProvider>
        <div className={cn("border border-input rounded-md bg-background overflow-hidden", className)}>
          <div className="flex items-center gap-0.5 flex-wrap px-1.5 py-1 border-b border-border bg-muted/40">
            <Btn icon={<Bold className="h-3.5 w-3.5" />} label="Жирный (Ctrl+B)" onClick={() => apply({ kind: "wrap", before: "**", after: "**", placeholder: "жирный" })} />
            <Btn icon={<Italic className="h-3.5 w-3.5" />} label="Курсив (Ctrl+I)" onClick={() => apply({ kind: "wrap", before: "*", after: "*", placeholder: "курсив" })} />
            <Btn icon={<Strikethrough className="h-3.5 w-3.5" />} label="Зачёркнутый" onClick={() => apply({ kind: "wrap", before: "~~", after: "~~", placeholder: "текст" })} />
            <Btn icon={<Code className="h-3.5 w-3.5" />} label="Код" onClick={() => apply({ kind: "wrap", before: "`", after: "`", placeholder: "code" })} />
            <div className="w-px h-5 bg-border mx-1" />
            <Btn icon={<Heading1 className="h-3.5 w-3.5" />} label="Заголовок 1" onClick={() => apply({ kind: "line", prefix: "# " })} />
            <Btn icon={<Heading2 className="h-3.5 w-3.5" />} label="Заголовок 2" onClick={() => apply({ kind: "line", prefix: "## " })} />
            <div className="w-px h-5 bg-border mx-1" />
            <Btn icon={<List className="h-3.5 w-3.5" />} label="Список" onClick={() => apply({ kind: "line", prefix: "- " })} />
            <Btn icon={<ListOrdered className="h-3.5 w-3.5" />} label="Нумерованный" onClick={() => apply({ kind: "line", prefix: "1. " })} />
            <Btn icon={<CheckSquare className="h-3.5 w-3.5" />} label="Чекбокс" onClick={() => apply({ kind: "line", prefix: "- [ ] " })} />
            <Btn icon={<Quote className="h-3.5 w-3.5" />} label="Цитата" onClick={() => apply({ kind: "line", prefix: "> " })} />
            <div className="w-px h-5 bg-border mx-1" />
            <Btn icon={<LinkIcon className="h-3.5 w-3.5" />} label="Ссылка (Ctrl+K)" onClick={insertLink} />
            <Btn icon={<ImageIcon className="h-3.5 w-3.5" />} label="Изображение" onClick={insertImage} />
            <Btn icon={<Minus className="h-3.5 w-3.5" />} label="Разделитель" onClick={() => apply({ kind: "insert", text: "\n\n---\n\n" })} />
            <div className="ml-auto">
              <Btn
                icon={preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                label={preview ? "Редактор" : "Превью"}
                onClick={() => setPreview((p) => !p)}
              />
            </div>
          </div>
          {preview ? (
            <div className="p-3 text-sm min-h-[120px] prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
              {value.trim() ? <RichDescription>{value}</RichDescription> : <span className="text-muted-foreground">Пусто</span>}
            </div>
          ) : (
            <Textarea
              id={id}
              ref={taRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={onPaste}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={rows}
              className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-y font-mono text-sm"
            />
          )}
        </div>
      </TooltipProvider>
    );
  }
);
RichTextEditor.displayName = "RichTextEditor";
