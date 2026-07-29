import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormLabel, FieldError, FormFieldGroup } from "@/components/ui/form-primitives";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Clock, Loader2, AlertCircle } from "lucide-react";

const meta = {
  title: "Components/KPR SLA Config Dialog",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Wrapper for consistent dialog rendering in stories */
function DialogWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Dialog open>
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                <Clock className="h-5 w-5 text-[#4F6F52]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">
                  Tambah Konfigurasi SLA
                </DialogTitle>
                <DialogDescription className="text-xs text-[#66736A] mt-1">
                  Tentukan target SLA baru untuk tahap KPR
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export const EmptyForm: Story = {
  render: () => (
    <DialogWrapper>
      <FormFieldGroup>
        <FormLabel required>Lingkup</FormLabel>
        <Select value="global">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue>Global</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="global" className="text-xs">Global</SelectItem>
            <SelectItem value="perumahan" className="text-xs">Per Perumahan</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Tahap KPR</FormLabel>
        <Select value="">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue placeholder="Pilih tahap..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="bi_checking" className="text-xs">BI Checking</SelectItem>
            <SelectItem value="pemberkasan" className="text-xs">Pemberkasan</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel htmlFor="wd" required>Target SLA (Hari Kerja)</FormLabel>
        <Input id="wd" type="number" placeholder="1-60" className="bg-card rounded-xl text-xs h-9 font-mono tabular-nums border-input" />
      </FormFieldGroup>
      <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
        <Button variant="outline" className="rounded-xl text-xs h-9">Batal</Button>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 rounded-xl font-bold text-xs px-4">Simpan</Button>
      </DialogFooter>
    </DialogWrapper>
  ),
};

export const FilledForm: Story = {
  render: () => (
    <DialogWrapper>
      <FormFieldGroup>
        <FormLabel required>Lingkup</FormLabel>
        <Select value="perumahan">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue>Per Perumahan</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="global" className="text-xs">Global</SelectItem>
            <SelectItem value="perumahan" className="text-xs">Per Perumahan</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Perumahan</FormLabel>
        <Select value="proj-1">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue>Grand Harmony Residence</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="proj-1" className="text-xs">Grand Harmony Residence</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Tahap KPR</FormLabel>
        <Select value="pemberkasan">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue>Pemberkasan</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="pemberkasan" className="text-xs">Pemberkasan</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel htmlFor="wd2" required>Target SLA (Hari Kerja)</FormLabel>
        <Input id="wd2" type="number" value={5} className="bg-card rounded-xl text-xs h-9 font-mono tabular-nums border-input" />
      </FormFieldGroup>
      <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
        <Button variant="outline" className="rounded-xl text-xs h-9">Batal</Button>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 rounded-xl font-bold text-xs px-4">Simpan</Button>
      </DialogFooter>
    </DialogWrapper>
  ),
};

export const ValidationErrors: Story = {
  render: () => (
    <DialogWrapper>
      <FormFieldGroup>
        <FormLabel required>Lingkup</FormLabel>
        <Select value="perumahan">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue>Per Perumahan</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="perumahan" className="text-xs">Per Perumahan</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Perumahan</FormLabel>
        <Select value="">
          <SelectTrigger className="w-full text-xs rounded-xl border border-destructive bg-card h-9" aria-invalid="true">
            <SelectValue placeholder="Pilih perumahan..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl"><SelectItem value="_" className="text-xs">—</SelectItem></SelectContent>
        </Select>
        <FieldError>Perumahan wajib dipilih</FieldError>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Tahap KPR</FormLabel>
        <Select value="">
          <SelectTrigger className="w-full text-xs rounded-xl border border-destructive bg-card h-9" aria-invalid="true">
            <SelectValue placeholder="Pilih tahap..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl"><SelectItem value="_" className="text-xs">—</SelectItem></SelectContent>
        </Select>
        <FieldError>Tahap KPR wajib dipilih</FieldError>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel htmlFor="wd3" required>Target SLA (Hari Kerja)</FormLabel>
        <Input id="wd3" type="number" value={99} className="bg-card rounded-xl text-xs h-9 font-mono tabular-nums border-destructive" aria-invalid="true" />
        <FieldError>Target SLA maksimal 60 Hari Kerja</FieldError>
      </FormFieldGroup>
      <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
        <Button variant="outline" className="rounded-xl text-xs h-9">Batal</Button>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 rounded-xl font-bold text-xs px-4">Simpan</Button>
      </DialogFooter>
    </DialogWrapper>
  ),
};

export const Submitting: Story = {
  render: () => (
    <DialogWrapper>
      <FormFieldGroup>
        <FormLabel required>Lingkup</FormLabel>
        <Select value="global" disabled>
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9 opacity-60">
            <SelectValue>Global</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="global" className="text-xs">Global</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Tahap KPR</FormLabel>
        <Select value="bi_checking" disabled>
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9 opacity-60">
            <SelectValue>BI Checking</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="bi_checking" className="text-xs">BI Checking</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel htmlFor="wd4" required>Target SLA (Hari Kerja)</FormLabel>
        <Input id="wd4" type="number" value={2} disabled className="bg-card rounded-xl text-xs h-9 font-mono tabular-nums border-input opacity-60" />
      </FormFieldGroup>
      <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
        <Button variant="outline" className="rounded-xl text-xs h-9" disabled>Batal</Button>
        <Button disabled className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 rounded-xl font-bold text-xs px-4 gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Simpan
        </Button>
      </DialogFooter>
    </DialogWrapper>
  ),
};

export const Timeout: Story = {
  render: () => (
    <DialogWrapper>
      <div role="alert" className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        Penyimpanan belum selesai; periksa koneksi lalu coba lagi
      </div>
      <FormFieldGroup>
        <FormLabel required>Lingkup</FormLabel>
        <Select value="global">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue>Global</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="global" className="text-xs">Global</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel required>Tahap KPR</FormLabel>
        <Select value="bi_checking">
          <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9">
            <SelectValue>BI Checking</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="bi_checking" className="text-xs">BI Checking</SelectItem>
          </SelectContent>
        </Select>
      </FormFieldGroup>
      <FormFieldGroup>
        <FormLabel htmlFor="wd5" required>Target SLA (Hari Kerja)</FormLabel>
        <Input id="wd5" type="number" value={2} className="bg-card rounded-xl text-xs h-9 font-mono tabular-nums border-input" />
      </FormFieldGroup>
      <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
        <Button variant="outline" className="rounded-xl text-xs h-9">Batal</Button>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 rounded-xl font-bold text-xs px-4">Simpan</Button>
      </DialogFooter>
    </DialogWrapper>
  ),
};
