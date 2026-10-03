import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Lock, ShieldCheck, Camera, Image, User, Send, UserPlus, Copy, Check, Plus, Trash2, LayoutGrid } from "lucide-react";
import { useCompanyLogo } from "@/hooks/useCompanyLogo";
import { useDirections } from "@/hooks/useDirections";
import { DirectionsManager } from "@/components/DirectionsManager";
import { BoardsManager } from "@/components/BoardsManager";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logAction } from "@/lib/actionLog";
import type { Database } from "@/integrations/supabase/types";

type ActionLog = Database["public"]["Tables"]["action_logs"]["Row"];

export default function Settings() {
  const { user, role, profile, refreshUserData } = useAuth();
  const { t } = useLanguage();
  const isAdmin = role === "admin";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const { logoUrl, refetch: refetchLogo } = useCompanyLogo();
  const { directions, save: saveDirections } = useDirections();
  const [telegramChatId, setTelegramChatId] = useState("");
  const [groupChats, setGroupChats] = useState<{ id?: string; chat_id: string; user_id: string }[]>([]);
  const [removedGroupIds, setRemovedGroupIds] = useState<string[]>([]);
  const [designers, setDesigners] = useState<{ id: string; name: string }[]>([]);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Load telegram chat ids (personal + groups) and designers
  useEffect(() => {
    if (!isAdmin) return;

    supabase
      .from("site_settings")
      .select("key,value")
      .eq("key", "telegram_chat_id")
      .then(({ data }) => {
        const value = data?.[0]?.value;
        if (value) setTelegramChatId(value);
      });

    supabase
      .from("telegram_group_chats")
      .select("id,chat_id,user_id")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setGroupChats((data ?? []).map((g) => ({ id: g.id, chat_id: g.chat_id, user_id: g.user_id ?? "" })));
      });

    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["user", "teamlead"]);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return;
      const { data: profs } = await supabase.from("profiles").select("id,name").in("id", ids).order("name");
      setDesigners((profs ?? []).map((p) => ({ id: p.id, name: p.name })));
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchActionLogs = async () => {
      setLogsLoading(true);
      const { data } = await supabase.from("action_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (data) setActionLogs(data);
      setLogsLoading(false);
    };

    fetchActionLogs();
  }, [isAdmin]);

  const saveSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase.from("site_settings").select("id").eq("key", key).maybeSingle();
    if (existing) {
      await supabase.from("site_settings").update({ value, updated_at: new Date().toISOString() } as any).eq("key", key);
    } else {
      await supabase.from("site_settings").insert({ key, value } as any);
    }
  };

  const handleSaveTelegram = async () => {
    setTelegramLoading(true);
    try {
      await saveSetting("telegram_chat_id", telegramChatId.trim());
      // legacy key is no longer used for group chats
      await saveSetting("telegram_group_chat_ids", "");

      if (removedGroupIds.length > 0) {
        await supabase.from("telegram_group_chats").delete().in("id", removedGroupIds);
      }

      const rows = groupChats.map((g) => ({ ...g, chat_id: g.chat_id.trim() })).filter((g) => g.chat_id);
      for (const g of rows) {
        const payload = { chat_id: g.chat_id, user_id: g.user_id || null };
        if (g.id) {
          await supabase.from("telegram_group_chats").update(payload as any).eq("id", g.id);
        } else {
          await supabase.from("telegram_group_chats").insert(payload as any);
        }
      }

      const { data } = await supabase
        .from("telegram_group_chats")
        .select("id,chat_id,user_id")
        .order("created_at", { ascending: true });
      setGroupChats((data ?? []).map((g) => ({ id: g.id, chat_id: g.chat_id, user_id: g.user_id ?? "" })));
      setRemovedGroupIds([]);

      await logAction({ action: "telegram_updated", entityType: "setting", details: { chatId: telegramChatId.trim(), groups: rows.length } });
      toast.success(t("settings.telegramSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    }
    setTelegramLoading(false);
  };


  // ---- Buyer creation (admin) ----
  const [buyerNick, setBuyerNick] = useState("");
  const [buyerRealName, setBuyerRealName] = useState("");
  const [buyerTags, setBuyerTags] = useState("");
  const [buyerLoading, setBuyerLoading] = useState(false);
  const [buyerCreds, setBuyerCreds] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCreateBuyer = async () => {
    const nick = buyerNick.trim();
    if (!/^[a-zA-Z0-9_.-]{2,40}$/.test(nick)) {
      toast.error("Ник: 2-40 символов, латиница/цифры/_.-");
      return;
    }
    setBuyerLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tagsList = buyerTags.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "create_buyer", nickname: nick, tags: tagsList },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      // Non-2xx: parse body from FunctionsHttpError context to get server error message
      if (res.error) {
        let msg = res.error.message || "Error";
        try {
          const ctx: any = (res.error as any).context;
          if (ctx?.json) { const j = await ctx.json(); if (j?.error) msg = j.error; }
          else if (ctx?.text) { const txt = await ctx.text(); const j = JSON.parse(txt); if (j?.error) msg = j.error; }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      const d = res.data as { email: string; password: string; userId: string };
      setBuyerCreds({ email: d.email, password: d.password });
      const realName = buyerRealName.trim();
      if (realName) {
        await (supabase as any).from("buyer_real_names").upsert({ buyer_id: d.userId, real_name: realName });
      }
      await logAction({ action: "created", entityType: "user", entityId: d.userId, targetUserId: d.userId, details: { role: "buyer", nickname: nick, tags: tagsList } });
      toast.success("Баер создан. Скопируйте логин и пароль — они больше не показываются.");
      setBuyerNick(""); setBuyerTags(""); setBuyerRealName("");
    } catch (e: any) {
      toast.error(e.message || "Ошибка создания");
    }
    setBuyerLoading(false);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch { toast.error("Не удалось скопировать"); }
  };

  // Sync displayName when profile loads
  useEffect(() => { if (profile?.name) setDisplayName(profile.name); }, [profile?.name]);

  const handleChangeName = async () => {
    if (!displayName.trim()) return;
    setNameLoading(true);
    const { error } = await supabase.from("profiles").update({ name: displayName.trim() }).eq("id", user!.id);
    setNameLoading(false);
    if (error) { toast.error(t("settings.profileError")); } else {
      await logAction({ action: "name_changed", entityType: "profile", entityId: user!.id, targetUserId: user!.id, details: { name: displayName.trim() } });
      toast.success(t("settings.nameUpdated"));
      await refreshUserData();
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLogoLoading(true);
    const ext = file.name.split(".").pop();
    const filePath = `logo/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("company-assets").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error(t("settings.uploadError") + ": " + uploadError.message); setLogoLoading(false); return; }
    const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(filePath);
    const { error: updateError } = await supabase.from("site_settings").update({ value: urlData.publicUrl, updated_at: new Date().toISOString() } as any).eq("key", "company_logo");
    if (updateError) { toast.error(t("settings.saveError") + ": " + updateError.message); } else {
      await logAction({ action: "logo_updated", entityType: "setting", details: { key: "company_logo", fileName: file.name } });
      toast.success(t("settings.logoUpdated"));
      refetchLogo();
    }
    setLogoLoading(false);
    e.target.value = "";
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error(t("reset.minError")); return; }
    if (newPassword !== confirmPassword) { toast.error(t("reset.mismatch")); return; }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) { toast.error(error.message); } else {
      toast.success(t("settings.passwordChanged"));
      setNewPassword(""); setConfirmPassword("");
    }
  };

  const handleActivateAdmin = async () => {
    if (!adminCode.trim()) { toast.error(t("settings.enterCode")); return; }
    setAdminLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("activate-admin", {
        body: { code: adminCode },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) { toast.error(res.error.message || "Error"); }
      else if (res.data?.error) { toast.error(res.data.error); }
      else { toast.success(t("settings.adminActivated")); setAdminCode(""); await refreshUserData(); }
    } catch { toast.error("Network error"); }
    setAdminLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarLoading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error(t("settings.uploadError") + ": " + uploadError.message); setAvatarLoading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl } as any).eq("id", user.id);
    if (updateError) { toast.error(t("settings.profileError")); } else {
      await logAction({ action: "avatar_updated", entityType: "profile", entityId: user.id, targetUserId: user.id, details: { fileName: file.name } });
      toast.success(t("settings.avatarUpdated"));
      await refreshUserData();
    }
    setAvatarLoading(false);
    e.target.value = "";
  };

  const avatarUrl = (profile as any)?.avatar_url;
  const initials = profile?.name?.charAt(0)?.toUpperCase() || "?";
  const formatActionLog = (log: ActionLog) => {
    const details = (log.details ?? {}) as Record<string, any>;
    const title = details.title || details.fileName || details.newEmail || details.newName || details.name || details.key || "";
    const suffix = title ? ` — ${title}` : "";
    return `${log.entity_type} / ${log.action}${suffix}`;
  };

  return (
    <AppShell>
      <div className="p-6 max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

        {isAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> {t("settings.boards")}</CardTitle>
                <CardDescription>{t("settings.boardsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <BoardsManager />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> {t("settings.companyLogo")}</CardTitle>
                <CardDescription>{t("settings.logoDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-lg border border-border cursor-pointer" onClick={() => logoRef.current?.click()} />
                ) : (
                  <div className="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center cursor-pointer text-muted-foreground" onClick={() => logoRef.current?.click()}>
                    <Image className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={logoLoading}>
                    {logoLoading ? t("detail.uploading") : logoUrl ? t("settings.changeLogo") : t("settings.uploadLogo")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <DirectionsManager directions={directions} onSave={saveDirections} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Создать баера</CardTitle>
                <CardDescription>Введите ник — email и пароль сгенерируются автоматически. Покажутся один раз — скопируйте и передайте баеру.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Ник (латиница, цифры, _ . -)</Label>
                  <Input value={buyerNick} onChange={(e) => setBuyerNick(e.target.value)} placeholder="john_doe" />
                </div>
                <div className="space-y-2">
                  <Label>Настоящее имя (видят только админы и тимлиды)</Label>
                  <Input value={buyerRealName} onChange={(e) => setBuyerRealName(e.target.value)} placeholder="ВЛ" />
                </div>
                <div className="space-y-2">
                  <Label>Теги через запятую (опционально)</Label>
                  <Input value={buyerTags} onChange={(e) => setBuyerTags(e.target.value)} placeholder="GEO-US, Nutra" />
                </div>
                <Button onClick={handleCreateBuyer} disabled={buyerLoading || !buyerNick.trim()}>
                  {buyerLoading ? "Создание..." : "Создать баера"}
                </Button>

                {buyerCreds && (
                  <div className="mt-3 p-3 rounded border border-primary/40 bg-primary/5 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">Данные для входа (сохраните сейчас)</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-16 text-muted-foreground">Email:</span>
                      <code className="flex-1 text-xs bg-background px-2 py-1 rounded break-all">{buyerCreds.email}</code>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(buyerCreds.email, "email")}>
                        {copiedField === "email" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-16 text-muted-foreground">Пароль:</span>
                      <code className="flex-1 text-xs bg-background px-2 py-1 rounded break-all">{buyerCreds.password}</code>
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(buyerCreds.password, "password")}>
                        {copiedField === "password" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <button className="text-[10px] text-muted-foreground underline" onClick={() => setBuyerCreds(null)}>Скрыть</button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> {t("settings.telegramTitle")}</CardTitle>
                <CardDescription>{t("settings.telegramDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("settings.telegramChatId")}</Label>
                  <Input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="123456789" />
                  <p className="text-xs text-muted-foreground">{t("settings.telegramHint")}</p>
                </div>

                <div className="space-y-2">
                  <Label>Групповые чаты</Label>
                  <p className="text-xs text-muted-foreground">
                    Добавьте бота в группу и укажите её ID (обычно с минусом, например -1001234567890).
                    Выберите исполнителя — тогда в эту группу будут приходить уведомления только по его задачам.
                    «Все задачи» — группа получает уведомления по всем задачам.
                  </p>
                  {groupChats.map((chat, i) => (
                    <div key={chat.id ?? `new-${i}`} className="flex items-center gap-2">
                      <Input
                        value={chat.chat_id}
                        onChange={(e) =>
                          setGroupChats((prev) => prev.map((c, idx) => (idx === i ? { ...c, chat_id: e.target.value } : c)))
                        }
                        placeholder="-1001234567890"
                      />
                      <select
                        className="h-9 min-w-[180px] border-2 border-input bg-background px-2 text-xs"
                        value={chat.user_id}
                        onChange={(e) =>
                          setGroupChats((prev) => prev.map((c, idx) => (idx === i ? { ...c, user_id: e.target.value } : c)))
                        }
                      >
                        <option value="">Все задачи</option>
                        {designers.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0"
                        onClick={() => {
                          if (chat.id) setRemovedGroupIds((prev) => [...prev, chat.id!]);
                          setGroupChats((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGroupChats((prev) => [...prev, { chat_id: "", user_id: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Добавить чат
                  </Button>
                </div>


                <Button onClick={handleSaveTelegram} disabled={telegramLoading}>
                  {telegramLoading ? t("reset.saving") : t("users.save")}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> {t("settings.avatar")}</CardTitle>
            <CardDescription>{t("settings.avatarDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-20 w-20 cursor-pointer" onClick={() => fileRef.current?.click()}>
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={avatarLoading}>
                {avatarLoading ? t("detail.uploading") : t("settings.choosePhoto")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> {t("settings.changeName")}</CardTitle>
              <CardDescription>{t("settings.nameDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings.name")}</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("auth.yourName")} />
              </div>
              <Button onClick={handleChangeName} disabled={nameLoading || !displayName.trim()}>
                {nameLoading ? t("reset.saving") : t("users.save")}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> {t("settings.passwordTitle")}</CardTitle>
            <CardDescription>{t("settings.passwordDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("reset.newPassword")}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("reset.minChars")} />
            </div>
            <div className="space-y-2">
              <Label>{t("reset.confirmPassword")}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("reset.repeatPassword")} />
            </div>
            <Button onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? t("reset.saving") : t("reset.changePassword")}
            </Button>
          </CardContent>
        </Card>

        {role === "admin" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Журнал действий / Action Log</CardTitle>
                <CardDescription>Только для администратора</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72 rounded border border-border">
                  <div className="divide-y divide-border">
                    {logsLoading ? (
                      <div className="p-3 text-sm text-muted-foreground">Загрузка...</div>
                    ) : actionLogs.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">Пока нет записей</div>
                    ) : (
                      actionLogs.map((log) => (
                        <div key={log.id} className="p-3 space-y-1">
                          <div className="text-xs font-semibold">{formatActionLog(log)}</div>
                          <div className="text-[11px] text-muted-foreground break-all">actor: {log.actor_id}</div>
                          {log.target_user_id && <div className="text-[11px] text-muted-foreground break-all">target: {log.target_user_id}</div>}
                          <div className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" /> {t("settings.youAdmin")}
                </CardTitle>
                <CardDescription>{t("settings.adminDesc")}</CardDescription>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
