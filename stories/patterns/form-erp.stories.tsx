import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  FormLabel,
  FieldError,
  FieldHelp,
  FormFieldGroup,
} from "@/components/ui/form-primitives";

const meta = {
  title: "Patterns/Form ERP",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const primaryActionClass =
  "btn-premium bg-[#4F6F52] text-white hover:bg-[#3D563F]";

function FormShell({
  children,
  loading = false,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <form
      className="max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sage"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <h3 className="text-card-title text-foreground">Data Item Pekerjaan</h3>
        <p className="text-xs text-muted-foreground">
          Contoh pola form standar ERP (master data).
        </p>
      </div>
      {children}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" className="h-9 rounded-xl text-xs">
          Batal
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className={`${primaryActionClass} h-9 gap-2 rounded-xl text-xs font-bold`}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan
        </Button>
      </div>
    </form>
  );
}

/** Default empty state with required marks and helper text. */
export const Default: Story = {
  render: () => (
    <FormShell>
      <FormFieldGroup>
        <FormLabel required>Kode</FormLabel>
        <Input
          placeholder="mis. PEK-001"
          className="h-9 rounded-xl border-input bg-card font-mono text-xs uppercase"
        />
        <FieldHelp>Gunakan huruf kapital, angka, dan tanda strip.</FieldHelp>
      </FormFieldGroup>

      <FormFieldGroup>
        <FormLabel required>Nama Pekerjaan</FormLabel>
        <Input placeholder="mis. Pekerjaan Pondasi" className="h-9 rounded-xl border-input bg-card text-xs" />
      </FormFieldGroup>

      <FormFieldGroup>
        <FormLabel>
          Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span>
        </FormLabel>
        <Textarea placeholder="Rincian pekerjaan..." className="min-h-[70px] resize-none rounded-xl border-input bg-card text-xs" />
      </FormFieldGroup>
    </FormShell>
  ),
};

/** Filled state — values entered, no errors. */
export const Filled: Story = {
  render: () => (
    <FormShell>
      <FormFieldGroup>
        <FormLabel required>Kode</FormLabel>
        <Input defaultValue="PEK-001" className="h-9 rounded-xl border-input bg-card font-mono text-xs uppercase" />
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Nama Pekerjaan</FormLabel>
        <Input defaultValue="Pekerjaan Pondasi Batu Kali" className="h-9 rounded-xl border-input bg-card text-xs" />
      </FormFieldGroup>
    </FormShell>
  ),
};

/** Error state — invalid fields with accessible role="alert" messages. */
export const WithErrors: Story = {
  render: () => (
    <FormShell>
      <FormFieldGroup>
        <FormLabel required>Kode</FormLabel>
        <Input
          defaultValue="pek 001"
          aria-invalid
          className="h-9 rounded-xl border-destructive bg-card font-mono text-xs"
        />
        <FieldError>Hanya huruf kapital, angka, dan tanda strip.</FieldError>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Nama Pekerjaan</FormLabel>
        <Input aria-invalid className="h-9 rounded-xl border-destructive bg-card text-xs" />
        <FieldError>Nama wajib diisi.</FieldError>
      </FormFieldGroup>
    </FormShell>
  ),
};

/** Disabled state — all controls non-interactive. */
export const Disabled: Story = {
  render: () => (
    <FormShell>
      <FormFieldGroup>
        <FormLabel required>Kode</FormLabel>
        <Input disabled defaultValue="PEK-001" className="h-9 rounded-xl border-input bg-card font-mono text-xs" />
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Nama Pekerjaan</FormLabel>
        <Input disabled defaultValue="Pekerjaan Pondasi" className="h-9 rounded-xl border-input bg-card text-xs" />
      </FormFieldGroup>
    </FormShell>
  ),
};

/** Loading state — submit button shows spinner and is disabled. */
export const Loading: Story = {
  render: () => (
    <FormShell loading>
      <FormFieldGroup>
        <FormLabel required>Kode</FormLabel>
        <Input defaultValue="PEK-001" className="h-9 rounded-xl border-input bg-card font-mono text-xs" />
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Nama Pekerjaan</FormLabel>
        <Input defaultValue="Pekerjaan Pondasi" className="h-9 rounded-xl border-input bg-card text-xs" />
      </FormFieldGroup>
    </FormShell>
  ),
};
