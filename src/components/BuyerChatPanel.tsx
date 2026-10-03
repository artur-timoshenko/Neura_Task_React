import { SignedTaskImage } from "@/components/SignedTaskImage";
import { useEffect, useRef, useState } from "react";
import { supabase, API_URL, PUBLIC_CLIENT_ID } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Trash2, ImagePlus, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Linkify } from "@/components/Linkify";
import { sanitizeFileName } from "@/lib/sanitizeFileName";

interface BuyerChatPanelProps {
  designerId: string;
  buyerId: string;
  designerName?: string | null;
  buyerName?: string | null;
}

type Msg = {
  id: string;
  designer_id: string;
  buyer_id: string;
  sender_id: string;
  as_buyer: boolean;
  body: string | null;
  image_url: string | null;
  created_at: string;
};

export function BuyerChatPanel({ designerId, buyerId, designerName, buyerName }: BuyerChatPanelProps) {
  const { user, role, profile } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === "admin" || role === "teamlead";
  const isDesigner = user?.id === designerId;
  const isBuyer = user?.id === buyerId;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendAsSelf, setSendAsSelf] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const fetch = async () => {
    const { data } = await (supabase as any)
      .from("buyer_chat_messages")
      .select("*")
      .eq("designer_id", designerId)
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data as Msg[]);
      const ids = [...new Set(data.map((m: any) => m.sender_id))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", ids as string[]);
        if (profs) {
          const map: Record<string, string> = {};
          profs.forEach((p: any) => { map[p.id] = p.name || p.email || p.id.slice(0, 8); });
          setProfileMap((prev) => ({ ...prev, ...map }));
        }
      }
    }
  };

  useEffect(() => {
    fetch();
    const ch = supabase.channel(`buyer-chat-${designerId}-${buyerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_chat_messages", filter: `designer_id=eq.${designerId}` }, (p: any) => {
        if (p.new?.buyer_id === buyerId || p.old?.buyer_id === buyerId) fetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designerId, buyerId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages.length]);

  const handlePickImage = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Только изображения"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("Максимум 10 МБ"); return; }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    if (sendingRef.current) return;
    if ((!text.trim() && !imageFile) || !user) return;
    sendingRef.current = true;
    setSending(true);
    const bodyToSend = text.trim();
    const fileToSend = imageFile;
    // Optimistically clear input so user can't resubmit the same content
    setText("");
    clearImage();
    try {
      let uploadedUrl: string | null = null;
      if (fileToSend) {
        const safeName = sanitizeFileName(fileToSend.name);
        const path = `buyer-chat/${designerId}/${buyerId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("task-files").upload(path, fileToSend, { upsert: false });
        if (upErr) { toast.error(t("chat.uploadFailed") + upErr.message); return; }
        uploadedUrl = path;
      }
      const asBuyer = isAdmin && !sendAsSelf;
      const { error } = await (supabase as any).from("buyer_chat_messages").insert({
        designer_id: designerId,
        buyer_id: buyerId,
        sender_id: user.id,
        as_buyer: asBuyer,
        body: bodyToSend || null,
        image_url: uploadedUrl,
      });
      if (error) { toast.error(error.message); return; }

      if (!isAdmin || asBuyer) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const senderRole = asBuyer || isBuyer ? "buyer" : "designer";
          const senderName = asBuyer ? (buyerName || t("chats.buyer")) : (profile?.name || user.email || "Пользователь");
          await window.fetch(`${API_URL}/functions/v1/notify-telegram-chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
              apikey: PUBLIC_CLIENT_ID,
            },
            body: JSON.stringify({
              taskId: null, taskCode: null, designerId, buyerId,
              taskTitle: `Личный чат: ${designerName || "Дизайнер"} ↔ ${buyerName || "Баер"}`,
              senderName, senderRole,
              messageText: bodyToSend || (uploadedUrl ? "📷 изображение" : ""),
              appUrl: window.location.origin,
            }),
          });
        } catch (e) { console.warn("Telegram notify failed", e); }
      }
      fetch();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("buyer_chat_messages").delete().eq("id", id);
    if (error) toast.error(error.message); else fetch();
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">{t("chat.empty")}</p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === user?.id && !m.as_buyer;
          const actual = profileMap[m.sender_id] || m.sender_id.slice(0, 8);
          const display = m.as_buyer ? (isAdmin ? `${buyerName || t("chats.buyer")} (${t("chat.writtenByAdmin")}: ${actual})` : (buyerName || t("chats.buyer"))) : actual;
          const canDelete = isAdmin || m.sender_id === user?.id;
          return (
            <div key={m.id} className={`p-2.5 rounded-lg text-sm max-w-[80%] ${isMine ? "bg-primary/15 ml-auto" : m.as_buyer ? "bg-accent/30" : "bg-muted"}`}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-[11px] font-semibold truncate">{display}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  {canDelete && <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>}
                </div>
              </div>
              {m.image_url && (
                <SignedTaskImage source={m.image_url} alt="attachment" className="max-h-64 rounded border border-border" />
              )}
              {m.body && <p className="whitespace-pre-wrap text-xs sm:text-sm break-words"><Linkify>{m.body}</Linkify></p>}
            </div>
          );
        })}
      </div>
      <div className="border-t border-border p-3 space-y-2 bg-card">
        {isAdmin && (
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={sendAsSelf} onCheckedChange={(v) => setSendAsSelf(!!v)} />
            <span className="text-[11px] text-muted-foreground">{t("chat.sendAsSelf")}{buyerName ? ` (${buyerName})` : ""}</span>
          </label>
        )}
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="preview" className="max-h-24 rounded border border-border" />
            <button onClick={clearImage} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePickImage(e.target.files?.[0] || null)} />
          <Button size="icon" variant="outline" onClick={() => fileInputRef.current?.click()} className="shrink-0 self-end" title={t("chat.attachImage")}>
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
              if (item) { const f = item.getAsFile(); if (f) handlePickImage(f); }
            }}
            placeholder={isAdmin && !sendAsSelf ? (buyerName ? `${t("chat.asBuyerPlaceholder").replace("...", "")} ${buyerName}...` : t("chat.asBuyerPlaceholder")) : t("chat.placeholder")}
            rows={2}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (sending || sendingRef.current) return;
                handleSend();
              }
            }}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || (!text.trim() && !imageFile)} className="shrink-0 self-end">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
