import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const primaryButtonClass =
  "btn-premium bg-[#4F6F52] text-white hover:bg-[#3D563F]";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
  args: {
    children: "Simpan",
    variant: "default",
    size: "default",
    className: primaryButtonClass,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button className={primaryButtonClass}>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs" className={primaryButtonClass}>Extra Small</Button>
      <Button size="sm" className={primaryButtonClass}>Small</Button>
      <Button size="default" className={primaryButtonClass}>Default</Button>
      <Button size="lg" className={primaryButtonClass}>Large</Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <Button className={primaryButtonClass}>
      <Plus />
      Tambah Unit
    </Button>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, className: primaryButtonClass },
};

export const Loading: Story = {
  render: () => (
    <Button disabled className={primaryButtonClass}>
      <Loader2 className="animate-spin" />
      Menyimpan...
    </Button>
  ),
};
