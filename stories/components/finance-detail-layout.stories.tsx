import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileText, Wallet, CalendarDays, Building2, User } from "lucide-react";
import {
  FinanceDetailLayout,
  FinanceDetailGrid,
  FinanceDetailField,
} from "@/components/finance/finance-detail-layout";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * FinanceDetailLayout is the presentational shell shared by all five finance
 * detail pages. It fixes the top-to-bottom section order
 * (Header → Summary cards → Detail metadata → Timeline) and centralizes the
 * Sage Green / light-theme rules.
 *
 * The layout is a set of slots: this story fills them with a sample header,
 * summary cards, detail metadata, and a static timeline placeholder node
 * (the real `<FinanceTimeline>` is an async server component that fetches the
 * DB and cannot render in Storybook — see FinanceTimeline stories).
 *
 * Design / requirements: 2.1–2.4, 2.8–2.11, 11.2, 11.5, 11.6.
 */
const meta = {
  title: "Finance/FinanceDetailLayout",
  component: FinanceDetailLayout,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Standard finance detail shell. Header → Summary → Detail → Timeline, fixed order. " +
          "Responsive: 1-col <768px, 2-col 768–1024px, full multi-col ≥1024px. Light theme only.",
      },
    },
  },
  // The story below overrides everything via `render`; these satisfy the
  // layout's required props for the meta type.
  args: {
    icon: <FileText className="h-5 w-5" />,
    docNumber: "INV-2026-0001",
    backHref: "/finance",
    summary: null,
    details: null,
    timeline: null,
  },
} satisfies Meta<typeof FinanceDetailLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A static stand-in for the async <FinanceTimeline> server component. */
function TimelinePlaceholder() {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">Timeline Aktivitas</CardTitle>
        <CardDescription className="text-muted-foreground">
          Riwayat aktivitas finance dari terbaru ke terlama
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-6 border-l border-border pl-6">
          <li className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <span className="text-sm font-semibold text-foreground">Lunas</span>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Admin Keuangan &middot; <span className="tabular-nums">22 Mei 2026, 14:30</span>
            </div>
          </li>
          <li className="relative">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <span className="text-sm font-semibold text-foreground">Dibuat</span>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Admin Keuangan &middot; <span className="tabular-nums">01 Mei 2026, 09:12</span>
            </div>
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}

export const InvoiceDetail: Story = {
  render: () => (
    <FinanceDetailLayout
      icon={<FileText className="h-5 w-5" />}
      docNumber="INV-2026-0001"
      statusBadge={<Badge>Lunas</Badge>}
      projectName="Graha Mulia — Blok A"
      backHref="/finance"
      headerActions={
        <Button variant="outline" size="sm">
          Cetak Invoice
        </Button>
      }
      summary={
        <FinanceDetailGrid cols={3}>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardDescription>Total Tagihan</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">Rp 150.000.000</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardDescription>Terbayar</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">Rp 150.000.000</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardDescription>Sisa</CardDescription>
              <CardTitle className="font-mono text-2xl tabular-nums">Rp 0</CardTitle>
            </CardHeader>
          </Card>
        </FinanceDetailGrid>
      }
      details={
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Detail Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceDetailGrid cols={3}>
              <FinanceDetailField label="Tipe" value="DP" />
              <FinanceDetailField
                label="Jatuh Tempo"
                value="30 Mei 2026"
                icon={<CalendarDays className="h-4 w-4" />}
              />
              <FinanceDetailField label="Metode" value="Transfer" icon={<Wallet className="h-4 w-4" />} />
              <FinanceDetailField label="Proyek" value="Graha Mulia" icon={<Building2 className="h-4 w-4" />} />
              <FinanceDetailField label="Konsumen" value="Budi Santoso" icon={<User className="h-4 w-4" />} />
              <FinanceDetailField label="Pembayaran Terkait">
                <FinanceDocLink href="/finance/payments/pay-001">PAY-2026-0042</FinanceDocLink>
              </FinanceDetailField>
              {/* Empty optional field renders an em dash rather than omitting the row (Req 2.8). */}
              <FinanceDetailField label="Catatan" value={null} />
            </FinanceDetailGrid>
          </CardContent>
        </Card>
      }
      timeline={<TimelinePlaceholder />}
    />
  ),
};
