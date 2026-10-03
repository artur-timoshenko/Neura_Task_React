import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Search } from "lucide-react";
import { BuyerChatPanel } from "@/components/BuyerChatPanel";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & { tags?: string[] };

type Pair = { designerId: string; buyerId: string };

export default function ChatsPage() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === "admin" || role === "teamlead";

  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [buyers, setBuyers] = useState<Profile[]>([]);
  const [designers, setDesigners] = useState<Profile[]>([]);
  const [existingDesignerIds, setExistingDesignerIds] = useState<Set<string>>(new Set());
  const [allowedBuyerIds, setAllowedBuyerIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState<string>("");
  const [selectedDesigner, setSelectedDesigner] = useState<string>("");
  const [realNames, setRealNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [{ data: roles }, { data: profs }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("*"),
      ]);
      const map: Record<string, Profile> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
      const buyerIds = (roles || []).filter((r: any) => r.role === "buyer").map((r: any) => r.user_id);
      const adminIds = new Set((roles || []).filter((r: any) => r.role === "admin" || r.role === "teamlead").map((r: any) => r.user_id));
      setBuyers(buyerIds.map((id: string) => map[id]).filter(Boolean));
      // designers = all profiles NOT buyers and NOT admin/teamlead — regular users
      const designerList = (profs || []).filter((p: any) => !buyerIds.includes(p.id) && !adminIds.has(p.id));
      setDesigners(designerList as Profile[]);

      // For buyers: only show designers with existing threads (buyer cannot initiate)
      if (isAdmin) {
        const { data: rn } = await (supabase as any).from("buyer_real_names").select("buyer_id, real_name");
        const rmap: Record<string, string> = {};
        (rn || []).forEach((r: any) => { rmap[r.buyer_id] = r.real_name; });
        setRealNames(rmap);
      }

      // For buyers: only show designers with existing threads (buyer cannot initiate)
      if (user) {
        const [{ data: threads }, { data: myTasks }, { data: myBuyerThreads }] = await Promise.all([
          (supabase as any).from("buyer_chat_messages").select("designer_id").eq("buyer_id", user.id),
          (supabase as any).from("tasks").select("buyer_id").eq("user_id", user.id).not("buyer_id", "is", null),
          (supabase as any).from("buyer_chat_messages").select("buyer_id").eq("designer_id", user.id),
        ]);
        setExistingDesignerIds(new Set((threads || []).map((t: any) => t.designer_id)));
        const allowed = new Set<string>();
        (myTasks || []).forEach((t: any) => t.buyer_id && allowed.add(t.buyer_id));
        (myBuyerThreads || []).forEach((t: any) => t.buyer_id && allowed.add(t.buyer_id));
        setAllowedBuyerIds(allowed);
      }
    })();
  }, [user?.id, isAdmin]);

  const isBuyer = !!user && buyers.some((b) => b.id === user.id);
  const isDesigner = !!user && designers.some((d) => d.id === user.id);

  // Only designers (and admins) can initiate. Buyers only see designers they already have threads with.
  const showBuyers = isAdmin || isDesigner;
  const showDesigners = isAdmin || (isBuyer && existingDesignerIds.size > 0);

  const visibleDesigners = isAdmin ? designers : designers.filter((d) => existingDesignerIds.has(d.id));
  // Designer sees only buyers who assigned them a task (or already wrote to them)
  const visibleBuyers = isAdmin ? buyers : buyers.filter((b) => allowedBuyerIds.has(b.id));

  const filterMatch = (p: Profile) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [p.name, p.email, isAdmin ? realNames[p.id] : null, ...(((p as any).tags as string[] | undefined) || [])].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };

  const filteredBuyers = useMemo(() => visibleBuyers.filter(filterMatch), [visibleBuyers, query, realNames]);
  const filteredDesigners = useMemo(() => visibleDesigners.filter(filterMatch), [visibleDesigners, query]);

  // Compute effective pair for chat
  const pair: Pair | null = (() => {
    if (isAdmin) {
      if (selectedBuyer && selectedDesigner) return { designerId: selectedDesigner, buyerId: selectedBuyer };
      return null;
    }
    if (isDesigner && selectedBuyer && user) return { designerId: user.id, buyerId: selectedBuyer };
    if (isBuyer && selectedDesigner && user) return { designerId: selectedDesigner, buyerId: user.id };
    return null;
  })();

  return (
    <AppShell>
      <div className="h-[calc(100vh-30px)] md:h-screen flex flex-col md:flex-row">
        <aside className="md:w-80 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <h1 className="text-sm font-bold mb-2 flex items-center gap-2"><MessageCircle className="h-4 w-4" /> {t("chats.title")}</h1>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chats.search")} className="pl-7 h-8 text-xs" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {showBuyers && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 mb-1">{t("chats.buyers")}</p>
                {filteredBuyers.length === 0 && <p className="text-[11px] text-muted-foreground px-2">{t("chats.noMatches")}</p>}
                {filteredBuyers.map((b) => {
                  const tags = ((b as any).tags as string[] | undefined) || [];
                  return (
                    <button key={b.id} onClick={() => setSelectedBuyer(b.id)}
                      className={`w-full text-left flex items-start gap-2 p-2 rounded hover:bg-muted transition-colors ${selectedBuyer === b.id ? "bg-primary/15" : ""}`}>
                      <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={b.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{b.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{b.name || b.email}{isAdmin && realNames[b.id] ? ` (${realNames[b.id]})` : ""}</p>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.map((t) => <Badge key={t} variant="secondary" className="text-[9px] px-1 py-0">{t}</Badge>)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {showDesigners && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 mb-1">{t("chats.designers")}</p>
                {filteredDesigners.length === 0 && <p className="text-[11px] text-muted-foreground px-2">{t("chats.noMatches")}</p>}
                {filteredDesigners.map((d) => (
                  <button key={d.id} onClick={() => setSelectedDesigner(d.id)}
                    className={`w-full text-left flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors ${selectedDesigner === d.id ? "bg-primary/15" : ""}`}>
                    <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={d.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{d.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{d.name || d.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0 bg-background">
          {pair ? (
            <>
              <div className="border-b border-border p-3 bg-card">
                <p className="text-xs font-semibold">
                  {profiles[pair.designerId]?.name || t("chats.designer")} ↔ {profiles[pair.buyerId]?.name || t("chats.buyer")}{isAdmin && realNames[pair.buyerId] ? ` (${realNames[pair.buyerId]})` : ""}
                </p>
              </div>
              <BuyerChatPanel
                key={`${pair.designerId}-${pair.buyerId}`}
                designerId={pair.designerId}
                buyerId={pair.buyerId}
                designerName={profiles[pair.designerId]?.name}
                buyerName={profiles[pair.buyerId]?.name}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
              {isAdmin
                ? t("chats.pickBoth")
                : isDesigner
                ? t("chats.pickBuyer")
                : isBuyer
                ? t("chats.pickDesigner")
                : t("chats.noAccess")}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
