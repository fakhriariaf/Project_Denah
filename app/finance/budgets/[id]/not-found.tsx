import Link from "next/link";
import { Wallet, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Not-found state for a missing budget id (Req 10.5).
 *
 * Rendered by Next.js when the budget detail page calls `notFound()` for an id
 * that does not resolve to a budget. It explains the situation in Bahasa
 * Indonesia and links back to the Budget tab of the finance shell — never a
 * dead end. Sage Green tokens, light theme only.
 */
export default function BudgetNotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border border-l-4 border-l-primary bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <Wallet className="h-8 w-8" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Anggaran Tidak Ditemukan
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Anggaran yang Anda cari tidak tersedia. Anggaran mungkin telah dihapus
            atau tautannya sudah tidak berlaku.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-border/60 pt-4">
          <Link href="/finance?tab=budgets">
            <Button className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Tab Anggaran
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
