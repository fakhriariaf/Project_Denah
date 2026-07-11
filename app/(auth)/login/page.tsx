"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  KeyRound,
  Loader2,
  Mail,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { LoginBranding } from "./_components/login-branding";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useI18n();
  const year = new Date().getFullYear();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 503) {
          router.push("/maintenance");
          return;
        }

        const body = await response.json().catch(() => ({}));
        const message = body?.error?.message || body?.message || body?.error || "";
        const errorMessage = typeof message === "string" ? message : JSON.stringify(message);

        if (errorMessage.includes("pemeliharaan") || errorMessage.includes("maintenance")) {
          router.push("/maintenance");
          return;
        }

        setError(errorMessage || t("auth.login_failed"));
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError(t("auth.login_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info("Silakan hubungi administrator atau Super Admin Anda untuk menyetel ulang kata sandi.");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground lg:h-[100dvh] lg:min-h-0">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <Image
          src="/auth/login-background.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1720px] grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.07fr)_minmax(0,.93fr)]">
        <LoginBranding />

        <section className="flex min-h-screen items-center justify-center px-5 py-20 sm:px-8 lg:min-h-0 lg:py-8 lg:pl-12 lg:pr-10 xl:px-16">
          <div className="flex w-full max-w-[630px] flex-col overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-10 shadow-[0_24px_60px_rgba(51,75,55,0.13)] backdrop-blur-md sm:px-12 sm:py-12 [@media(min-height:900px)]:min-h-[780px]">
            <div className="text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-secondary text-primary">
                <Building2 className="size-10" strokeWidth={1.8} />
              </div>
              <h2 className="mt-5 font-serif text-4xl font-semibold tracking-tight text-primary">{t("auth.login_title")}</h2>
              <p className="mx-auto mt-3 max-w-[360px] text-[15px] leading-6 text-muted-foreground">{t("auth.login_subtitle")}</p>
            </div>

            <form onSubmit={handleLogin} className="mt-14 space-y-6 [@media(max-height:860px)]:mt-10 [@media(max-height:860px)]:space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-bold tracking-wide text-foreground">
                  {t("auth.email_label").toUpperCase()}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t("auth.email_placeholder")}
                    className="h-14 rounded-xl border-input bg-card pl-12 text-[15px] text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/25"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="text-xs font-bold tracking-wide text-foreground">
                    {t("auth.password_label").toUpperCase()}
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("auth.password_forgot")}
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    className="h-14 rounded-xl border-input bg-card pl-12 text-[15px] text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/25"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={loading}
                />
                Ingat saya
              </label>

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-14 w-full rounded-xl bg-primary text-[15px] font-bold text-primary-foreground shadow-[0_8px_16px_rgba(79,111,82,0.2)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_12px_22px_rgba(79,111,82,0.26)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    {t("auth.btn_verifying")}
                  </>
                ) : (
                  <>
                    {t("auth.btn_login")}
                    <ArrowRight className="size-5" />
                  </>
                )}
              </Button>
            </form>

            <div aria-hidden="true" className="mt-auto pt-12 [@media(max-height:860px)]:pt-8">
              <div className="h-px w-full bg-border/75" />
            </div>

            <div className="-mx-6 -mb-10 mt-6 rounded-b-[2rem] bg-muted px-6 py-5 text-center text-xs leading-5 text-muted-foreground sm:-mx-12 sm:-mb-12 sm:px-12">
              <span className="mx-auto block max-w-[360px]">{t("auth.footer_secure")}</span>
            </div>

            <div className="mt-6 text-center lg:hidden">
              <a
                href="/siteplan-public"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Lihat Siteplan Perumahan <ArrowRight className="size-4" />
              </a>
              <p className="mt-6 text-xs text-muted-foreground">© {year} Denah Property. All rights reserved.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
