"use client";

import { ArrowRight, Building2, CheckCircle2, Home, Layers, Sparkles } from "lucide-react";
import { Translate } from "@/components/translate";

/**
 * Left-side branding panel of the login screen (desktop only).
 * Stateless — safe to extract from the login page for testability.
 * Uses theme tokens where possible; sage-green literals kept only for the
 * marketing-style stat cards until a Sage brand palette is defined.
 */
export function LoginBranding() {
  const year = new Date().getFullYear();
  return (
    <section className="relative hidden min-h-screen flex-col overflow-hidden px-12 pb-8 pt-12 lg:flex lg:min-h-0 xl:px-20 [@media(max-height:960px)]:pb-5 [@media(max-height:960px)]:pt-12">
      <header className="relative z-10 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-background/70 text-primary shadow-sm backdrop-blur-sm">
          <Building2 className="size-7" strokeWidth={1.9} />
        </div>
        <div>
          <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">Denah Property</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Enterprise Resource Planning</p>
        </div>
      </header>

      <div className="relative z-10 mb-auto mt-8 max-w-[610px] py-4 [@media(max-height:960px)]:mt-6 [@media(max-height:960px)]:py-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/75 px-4 py-2 text-sm font-semibold text-primary [@media(max-height:960px)]:px-3 [@media(max-height:960px)]:py-1.5 [@media(max-height:960px)]:text-xs">
          <Sparkles className="size-4" />
          <Translate namespace="auth" translationKey="portal_badge" />
        </div>

        <h1 className="mt-5 max-w-[570px] font-serif text-[3.45rem] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground xl:text-[3.9rem] [@media(max-height:960px)]:mt-6 [@media(max-height:960px)]:text-[3.25rem]">
          <Translate namespace="auth" translationKey="hero_title_1" />
          <br />
          <span className="text-primary">
            <Translate namespace="auth" translationKey="hero_title_2" />
          </span>
          <br />
          <Translate namespace="auth" translationKey="hero_title_3" />
        </h1>

        <p className="mt-5 max-w-[520px] text-[15px] leading-7 text-muted-foreground [@media(max-height:960px)]:mt-5 [@media(max-height:960px)]:text-sm [@media(max-height:960px)]:leading-6">
          <Translate namespace="auth" translationKey="hero_desc" />
        </p>

        <div className="mt-7 grid max-w-[560px] grid-cols-2 gap-4 [@media(max-height:960px)]:mt-7 [@media(max-height:960px)]:gap-3">
          <StatCard
            icon={<CheckCircle2 className="size-5" />}
            value="98%"
            labelKey="stat_sold"
            hint="Blok A–F Graha Mulia"
          />
          <StatCard
            icon={<Building2 className="size-5" />}
            value="15+"
            labelKey="stat_active"
            hint="Tersebar di Jawa Barat"
          />

          <div className="col-span-2 flex items-center gap-4 rounded-2xl border border-card bg-background/80 p-4 shadow-[0_10px_24px_rgba(51,75,55,0.08)] backdrop-blur-sm [@media(max-height:960px)]:gap-3 [@media(max-height:960px)]:p-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Layers className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-primary">
                <Translate namespace="auth" translationKey="stat_interactive" />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <Translate namespace="auth" translationKey="stat_interactive_desc" />
              </p>
            </div>
          </div>
        </div>

        <PublicSiteplanCard />
      </div>

      <footer className="relative z-10 text-sm text-muted-foreground">
        © {year} Denah Property. All rights reserved.
      </footer>
    </section>
  );
}

function StatCard({
  icon,
  value,
  labelKey,
  hint,
}: {
  icon: React.ReactNode;
  value: string;
  labelKey: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-card bg-background/80 p-5 shadow-[0_10px_24px_rgba(51,75,55,0.08)] backdrop-blur-sm [@media(max-height:960px)]:p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
          {icon}
        </span>
        <span className="font-serif text-3xl font-semibold text-foreground tabular-nums">{value}</span>
      </div>
      <p className="mt-4 text-sm font-bold text-foreground [@media(max-height:960px)]:mt-3">
        <Translate namespace="auth" translationKey={labelKey} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PublicSiteplanCard() {
  return (
    <div className="mt-4 max-w-[560px] rounded-2xl border border-secondary bg-card/75 p-4 shadow-[0_10px_24px_rgba(51,75,55,0.08)] backdrop-blur-sm [@media(max-height:960px)]:mt-3 [@media(max-height:960px)]:p-3">
      <div className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          <Home className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-primary">Lihat Siteplan Perumahan</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Cek ketersediaan kavling dan progress pembangunan secara real-time.
          </p>
        </div>
      </div>
      <a
        href="/siteplan-public"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary bg-card/55 px-4 text-sm font-bold text-primary transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(max-height:960px)]:mt-3 [@media(max-height:960px)]:h-10"
      >
        Lihat Siteplan (Tanpa Login)
        <ArrowRight className="size-4" />
      </a>
    </div>
  );
}
