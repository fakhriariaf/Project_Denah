import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="invoices" className="w-96">
      <TabsList>
        <TabsTrigger value="invoices">Invoice</TabsTrigger>
        <TabsTrigger value="payments">Pembayaran</TabsTrigger>
        <TabsTrigger value="budgets">Anggaran</TabsTrigger>
      </TabsList>
      <TabsContent value="invoices" className="mt-4 text-sm text-muted-foreground">
        Daftar invoice yang diterbitkan.
      </TabsContent>
      <TabsContent value="payments" className="mt-4 text-sm text-muted-foreground">
        Riwayat pembayaran masuk.
      </TabsContent>
      <TabsContent value="budgets" className="mt-4 text-sm text-muted-foreground">
        Anggaran proyek aktif.
      </TabsContent>
    </Tabs>
  ),
};
