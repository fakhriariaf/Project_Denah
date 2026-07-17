import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormLabel, FormFieldGroup } from "@/components/ui/form-primitives";

const primaryActionClass =
  "btn-premium bg-[#4F6F52] text-white hover:bg-[#3D563F]";

const meta = {
  title: "Components/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button className={primaryActionClass}>Tambah Konsumen</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Konsumen</DialogTitle>
          <DialogDescription>Isi data konsumen baru di bawah ini.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <FormFieldGroup>
            <FormLabel required>Nama</FormLabel>
            <Input placeholder="mis. Budi Santoso" />
          </FormFieldGroup>
          <FormFieldGroup>
            <FormLabel required>Nomor Telepon</FormLabel>
            <Input placeholder="08xxxxxxxxxx" />
          </FormFieldGroup>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Batal</Button>} />
          <Button className={primaryActionClass}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
