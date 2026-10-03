import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();

  const toggleLang = () => setLang(lang === "ru" ? "en" : "ru");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: t("auth.loginError"), description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name }, emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: t("auth.signupError"), description: error.message, variant: "destructive" });
      } else {
        toast({ title: t("auth.accountCreated"), description: t("auth.checkEmail") });
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      sonnerToast.error(error.message);
    } else {
      sonnerToast.success(t("auth.resetSent") + email);
      setIsForgot(false);
    }
  };

  const langButton = (
    <button onClick={toggleLang} className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
      <Globe className="h-3.5 w-3.5" /> {lang === "ru" ? "RU" : "EN"}
    </button>
  );

  if (isForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        {langButton}
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <CompanyLogo className="h-10 w-10" iconClassName="h-5 w-5" />
            <h1 className="text-2xl font-semibold tracking-tight">Neura Team</h1>
          </div>
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">{t("auth.forgotTitle")}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t("auth.forgotDesc")}</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">{t("auth.email")}</Label>
                <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("auth.sending") : t("auth.sendLink")}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button onClick={() => setIsForgot(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("auth.backToLogin")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {langButton}
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <CompanyLogo className="h-10 w-10" iconClassName="h-5 w-5" />
          <h1 className="text-2xl font-semibold tracking-tight">Neura Team</h1>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">
            {isLogin ? t("auth.welcome") : t("auth.createAccount")}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isLogin ? t("auth.loginTo") : t("auth.startWith")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.yourName")} required={!isLogin} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth.loading") : isLogin ? t("auth.login") : t("auth.createAccount")}
            </Button>
          </form>

          {isLogin && (
            <div className="mt-4 text-center">
              <button onClick={() => setIsForgot(true)} className="text-sm text-primary hover:underline transition-colors">
                {t("auth.forgotPassword")}
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
