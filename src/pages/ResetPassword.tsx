import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();

  const toggleLang = () => setLang(lang === "ru" ? "en" : "ru");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setReady(true);
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error(t("reset.minError")); return; }
    if (password !== confirmPassword) { toast.error(t("reset.mismatch")); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); } else {
      toast.success(t("reset.success"));
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <button onClick={toggleLang} className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Globe className="h-3.5 w-3.5" /> {lang === "ru" ? "RU" : "EN"}
      </button>
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <CompanyLogo className="h-10 w-10" iconClassName="h-5 w-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Neura Team</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">{t("reset.title")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("reset.desc")}</p>
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("reset.loading")}</p>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("reset.newPassword")}</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("reset.minChars")} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>{t("reset.confirmPassword")}</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("reset.repeatPassword")} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("reset.saving") : t("reset.changePassword")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
