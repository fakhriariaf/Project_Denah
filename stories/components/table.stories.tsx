import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const meta = {
  title: "Components/Table",
  component: Table,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { code: "UNIT-A01", customer: "Budi Santoso", price: 875000000, status: "Terjual" },
  { code: "UNIT-A02", customer: "—", price: 910000000, status: "Tersedia" },
  { code: "UNIT-A03", customer: "Siti Aminah", price: 890000000, status: "Booking" },
];

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <Table>
        <TableCaption>Daftar unit Blok A.</TableCaption>
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
            <TableRow key={r.code}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.customer}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                Rp {r.price.toLocaleString("id-ID")}
              </TableCell>
              <TableCell>
                <Badge variant={r.status === "Tersedia" ? "secondary" : r.status === "Booking" ? "outline" : "default"}>
                  {r.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};
