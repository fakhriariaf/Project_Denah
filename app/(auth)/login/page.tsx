"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building2, KeyRound, Mail, Loader2, ArrowRight, CheckCircle2, ShieldAlert, Sparkles, Building, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message || t("auth.login_failed"));
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError(t("auth.login_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#F7F8F3] dark:bg-background text-[#243028] dark:text-foreground overflow-hidden relative">
      {/* Dynamic Theme Toggle at top right */}
      <div className="absolute top-6 right-6 z-50 w-auto">
        <ThemeToggle />
      </div>

      {/* LEFT PANEL: Rich Branding & Real-time Stats Visuals */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-login-branding dark:bg-secondary text-white relative overflow-hidden">
        {/* SVG Decorative Grid & Orbs */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/20">
            <Building2 className="w-6 h-6 text-[#DDE8D8]" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-lg">Denah Property</h1>
            <p className="text-xs text-[#DDE8D8]/70">Enterprise Resource Planning</p>
          </div>
        </div>

        {/* Center Highlights & Mockup Showcase */}
        <div className="relative z-10 my-auto py-12 space-y-8">
          <div className="space-y-4 max-w-lg">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-[#DDE8D8] font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> <Translate namespace="auth" translationKey="portal_badge" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              <Translate namespace="auth" translationKey="hero_title_1" /> <br />
              <span className="text-[#DDE8D8]"><Translate namespace="auth" translationKey="hero_title_2" /></span> <Translate namespace="auth" translationKey="hero_title_3" />
            </h2>
            <p className="text-sm text-[#DDE8D8]/80 leading-relaxed">
              <Translate namespace="auth" translationKey="hero_desc" />
            </p>
          </div>

          {/* Glowing Premium Metrics Card Stack */}
          <div className="grid grid-cols-2 gap-4 max-w-md pt-4">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-lg hover:bg-white/10 transition-premium">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="w-5 h-5 text-[#8FAF9A]" />
                <span className="text-2xl font-bold tracking-tight">98%</span>
              </div>
              <p className="text-xs font-semibold text-[#DDE8D8]/80"><Translate namespace="auth" translationKey="stat_sold" /></p>
              <p className="text-[10px] text-[#DDE8D8]/60 mt-1">Blok A-F Graha Mulia</p>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-lg hover:bg-white/10 transition-premium">
              <div className="flex items-center justify-between mb-2">
                <Building className="w-5 h-5 text-[#8FAF9A]" />
                <span className="text-2xl font-bold tracking-tight">15+</span>
              </div>
              <p className="text-xs font-semibold text-[#DDE8D8]/80"><Translate namespace="auth" translationKey="stat_active" /></p>
              <p className="text-[10px] text-[#DDE8D8]/60 mt-1">Tersebar di Jawa Barat</p>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-lg hover:bg-white/10 transition-premium col-span-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10">
                  <Layers className="w-4 h-4 text-[#8FAF9A]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white"><Translate namespace="auth" translationKey="stat_interactive" /></p>
                  <p className="text-[11px] text-[#DDE8D8]/70"><Translate namespace="auth" translationKey="stat_interactive_desc" /></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-[#DDE8D8]/60 flex items-center justify-between border-t border-white/10 pt-6">
          <span>&copy; {new Date().getFullYear()} Denah Property Perumahan.</span>
          <span>v2.1.0 Premium SaaS</span>
        </div>
      </div>

      {/* RIGHT PANEL: Modern Minimalist Login Form */}
      <div className="flex items-center justify-center p-6 md:p-12 relative">
        {/* Background blobs for mobile */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#8FAF9A]/10 blur-3xl pointer-events-none lg:hidden" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#8FAF9A]/10 blur-3xl pointer-events-none lg:hidden" />

        <div className="w-full max-w-[420px] space-y-8 relative z-10">
          {/* Header Mobile Brand (Hidden on Desktop) */}
          <div className="flex flex-col items-center text-center lg:hidden mb-8 space-y-3">
            <div className="bg-[#4F6F52] dark:bg-primary p-3 rounded-2xl shadow-sage">
              <Building2 className="w-7 h-7 text-white dark:text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl tracking-tight text-[#243028] dark:text-foreground">Denah Property</h1>
              <p className="text-xs text-[#66736A] dark:text-muted-foreground font-semibold mt-0.5">Enterprise Resource Planning Portal</p>
            </div>
          </div>

          {/* Desktop Login Header Intro */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#243028] dark:text-foreground">{t("auth.login_title")}</h2>
            <p className="text-sm text-[#66736A] dark:text-muted-foreground font-medium">
              {t("auth.login_subtitle")}
            </p>
          </div>

          <Card className="border-[#D6DED2]/80 dark:border-border/80 shadow-sage bg-white dark:bg-card rounded-3xl p-2">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-bold tracking-tight lg:hidden text-[#243028] dark:text-foreground">{t("auth.login_card_title")}</CardTitle>
              <CardDescription className="text-xs lg:hidden text-[#66736A] dark:text-muted-foreground">{t("auth.login_card_desc")}</CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#66736A] dark:text-muted-foreground uppercase tracking-wider pl-1">{t("auth.email_label")}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-[#66736A] dark:text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder={t("auth.email_placeholder")}
                      className="pl-10 h-12 bg-[#F7F8F3]/50 dark:bg-muted/50 border-[#D6DED2] dark:border-input rounded-xl focus:bg-white dark:focus:bg-card focus:border-[#8FAF9A] dark:focus:border-primary focus:ring-2 focus:ring-[#8FAF9A]/20 transition-premium shadow-sm text-sm dark:text-foreground"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-bold text-[#66736A] dark:text-muted-foreground uppercase tracking-wider">{t("auth.password_label")}</label>
                    <button
                      type="button"
                      onClick={() => alert("Silakan hubungi administrator atau Super Admin Anda untuk menyetel ulang kata sandi.")}
                      className="text-xs font-bold text-[#4F6F52] dark:text-primary hover:underline bg-transparent border-none p-0 focus:outline-none cursor-pointer"
                    >
                      {t("auth.password_forgot")}
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-[#66736A] dark:text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 h-12 bg-[#F7F8F3]/50 dark:bg-muted/50 border-[#D6DED2] dark:border-input rounded-xl focus:bg-white dark:focus:bg-card focus:border-[#8FAF9A] dark:focus:border-primary focus:ring-2 focus:ring-[#8FAF9A]/20 transition-premium shadow-sm text-sm dark:text-foreground"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                
                {error && (
                  <div className="p-3.5 rounded-xl bg-[#D77A7A]/10 text-[#D77A7A] text-xs font-semibold border border-[#D77A7A]/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full h-12 font-bold bg-[#8FAF9A] hover:bg-[#4F6F52] text-white dark:bg-primary dark:hover:bg-primary/90 dark:text-primary-foreground rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-98 active:translate-y-0 transition-premium text-sm flex items-center justify-center gap-2 cursor-pointer" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("auth.btn_verifying")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("auth.btn_login")}</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="flex justify-center border-t border-[#D6DED2]/40 dark:border-border/40 mt-4 pt-4 pb-2">
              <p className="text-[10px] text-[#66736A] dark:text-muted-foreground text-center max-w-[280px] leading-relaxed">
                {t("auth.footer_secure")}
              </p>
            </CardFooter>
          </Card>
          
          <div className="text-center lg:hidden pt-4">
            <p className="text-xs text-[#66736A]/60 dark:text-muted-foreground/60">
              &copy; {new Date().getFullYear()} Denah Property Perumahan.<br />All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
