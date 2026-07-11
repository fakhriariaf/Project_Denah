import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Search, Plus, FolderOpen, ChevronLeft, ChevronRight } from "lucide-react";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const meta = {
  title: "Patterns/Data Table",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { code: "UNIT-A01", customer: "Budi Santoso", price: 875000000, status: "Terjual", variant: "default" as const },
  { code: "UNIT-A02", customer: "—", price: 910000000, status: "Tersedia", variant: "secondary" as const },
  { code: "UNIT-A03", customer: "Siti Aminah", price: 890000000, status: "Booking", variant: "outline" as const },
  { code: "UNIT-A04", customer: "Andi Wijaya", price: 905000000, status: "Overdue", variant: "destructive" as const },
];

/** Standard toolbar: search + filter + primary action. */
function Toolbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-xs" role="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <input
          placeholder="Cari unit..."
          className="h-10 w-full rounded-xl border border-input bg-muted/40 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>
      <Button className="gap-1.5">
        <Plus /> Tambah Unit
      </Button>
    </div>
  );
}

function PaginationFooter() {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Menampilkan <span className="font-mono tabular-nums">1</span>–
        <span className="font-mono tabular-nums">4</span> dari{" "}
        <span className="font-mono tabular-nums">24</span> data
      </p>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-semibold text-muted-foreground">
          Halaman <span className="font-mono">1</span> dari <span className="font-mono">6</span>
        </span>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Full list page: toolbar + table with status badges + pagination. */
export const Default: Story = {
  render: () => (
    <div className="space-y-4">
      <Toolbar />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sage">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Konsumen</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.code} className="transition-colors hover:bg-muted/40">
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>{r.customer}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  Rp {r.price.toLocaleString("id-ID")}
                </TableCell>
                <TableCell>
                  <Badge variant={r.variant}>{r.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationFooter />
      </div>
    </div>
  ),
};

/** Loading state: skeleton rows while data fetches. */
export const Loading: Story = {
  render: () => (
    <div className="space-y-4">
      <Toolbar />
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sage">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  ),
};

/** Empty state: no data with a call-to-action. */
export const Empty: Story = {
  render: () => (
    <div className="space-y-4">
      <Toolbar />
      <div className="rounded-2xl border border-border bg-card shadow-sage">
        <EmptyState
          icon={<FolderOpen className="size-6" />}
          title="Belum ada unit"
          description="Data unit belum tersedia. Tambahkan unit pertama untuk memulai."
          action={{ label: "Tambah Unit" }}
        />
      </div>
    </div>
  ),
};
