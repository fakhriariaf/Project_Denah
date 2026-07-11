import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CircleDollarSign, Home, Users, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

const meta = {
  title: "Components/Stat Card",
  component: StatCard,
  parameters: { layout: "padded" },
  args: {
    title: "Total Pendapatan",
    value: "Rp 4.250.000.000",
    icon: <CircleDollarSign className="h-4 w-4" />,
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Total Pendapatan",
    value: "Rp 4.250.000.000",
    icon: <CircleDollarSign className="h-4 w-4" />,
    trend: { value: 12.5, direction: "up" },
  },
  render: (args) => (
    <div className="w-64">
      <StatCard {...args} />
    </div>
  ),
};

export const Grid: Story = {
  render: () => (
    <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Pendapatan"
        value="Rp 4,25M"
        icon={<CircleDollarSign className="h-4 w-4" />}
        trend={{ value: 12.5, direction: "up" }}
      />
      <StatCard
        title="Unit Terjual"
        value={182}
        icon={<Home className="h-4 w-4" />}
        trend={{ value: 8.2, direction: "up" }}
        colorScheme="#8FAF9A"
      />
      <StatCard
        title="Konsumen Aktif"
        value={340}
        icon={<Users className="h-4 w-4" />}
        colorScheme="#8FB8D8"
      />
      <StatCard
        title="Tunggakan"
        value="Rp 320jt"
        icon={<TrendingUp className="h-4 w-4" />}
        trend={{ value: 3.1, direction: "down" }}
        colorScheme="#D77A7A"
      />
    </div>
  ),
};
