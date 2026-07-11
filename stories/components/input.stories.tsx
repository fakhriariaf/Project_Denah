import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "@/components/ui/input";
import { FormLabel, FieldError, FieldHelp, FormFieldGroup } from "@/components/ui/form-primitives";

const meta = {
  title: "Components/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { placeholder: "Masukkan teks..." },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-72">
      <Input {...args} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <FormFieldGroup className="w-72">
      <FormLabel required>Nama Konsumen</FormLabel>
      <Input placeholder="mis. Budi Santoso" />
      <FieldHelp>Nama lengkap sesuai KTP.</FieldHelp>
    </FormFieldGroup>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormFieldGroup className="w-72">
      <FormLabel required>Email</FormLabel>
      <Input aria-invalid defaultValue="bukan-email" className="border-destructive" />
      <FieldError>Format email tidak valid.</FieldError>
    </FormFieldGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-72">
      <Input disabled defaultValue="Tidak bisa diubah" />
    </div>
  ),
};
