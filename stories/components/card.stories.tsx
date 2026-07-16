import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const primaryActionClass =
  "btn-premium bg-[#4F6F52] text-white hover:bg-[#3D563F]";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80 shadow-sage">
      <CardHeader>
        <CardTitle>Ringkasan Unit</CardTitle>
        <CardDescription>Blok A — Graha Mulia</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Total 24 unit, 18 terjual, 6 tersedia.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">Detail</Button>
        <Button size="sm" className={primaryActionClass}>Kelola</Button>
      </CardFooter>
    </Card>
  ),
};

export const KpiCard: Story = {
  render: () => (
    <Card className="w-60 shadow-sage">
      <CardHeader>
        <CardDescription>Total Pendapatan</CardDescription>
        <CardTitle className="font-mono text-2xl tabular-nums">Rp 4.2M</CardTitle>
      </CardHeader>
      <CardContent className="text-xs font-semibold text-emerald-600">
        ↑ 12,5% dari bulan lalu
      </CardContent>
    </Card>
  ),
};
