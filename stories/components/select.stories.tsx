import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FormLabel, FormFieldGroup } from "@/components/ui/form-primitives";

const meta = {
  title: "Components/Select",
  component: Select,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <FormFieldGroup className="w-64">
      <FormLabel required>Proyek</FormLabel>
      <Select defaultValue="a">
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih proyek..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Graha Mulia</SelectItem>
          <SelectItem value="b">Bukit Asri</SelectItem>
          <SelectItem value="c">Taman Sari</SelectItem>
        </SelectContent>
      </Select>
    </FormFieldGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormFieldGroup className="w-64">
      <FormLabel>Proyek</FormLabel>
      <Select disabled defaultValue="a">
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Graha Mulia</SelectItem>
        </SelectContent>
      </Select>
    </FormFieldGroup>
  ),
};
