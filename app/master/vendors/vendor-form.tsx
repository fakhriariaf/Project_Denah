"use client";
import { useRouter } from "next/navigation";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendorSchema, type VendorInput } from "@/server/validators/master";
import { createVendor, updateVendor } from "@/server/actions/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Truck, Loader2, AlertCircle, Copy, CheckCircle2, KeyRound } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";

const VENDOR_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
};

export function VendorForm({ 
  initialData, 
  id 
}: { 
  initialData?: VendorInput; 
  id?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!credential) return;
    navigator.clipboard.writeText(
      `Email: ${credential.email}\nPassword Sementara: ${credential.tempPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const form = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: initialData || {
      name: "",
      phone: "",
      email: "",
      address: "",
      legalDocNumber: "",
      status: "active",
      notes: "",
    },
  });
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = form;

  const onSubmit = (data: VendorInput) => {
    startTransition(async () => {
      setError(null);
      try {
        if (id) {
          await updateVendor(id, data);
          alert("Data vendor berhasil diperbarui!");
          setOpen(false);
          reset();
          router.refresh();
        } else {
          const result = await createVendor(data);
          if (result.accountCreated && result.email && result.tempPassword) {
            setCredential({ email: result.email, tempPassword: result.tempPassword });
          } else {
            if (result.warning) {
              alert(`Vendor berhasil dibuat.\n\nPeringatan: ${result.warning}`);
            } else {
              alert("Data vendor berhasil disimpan!");
            }
            setOpen(false);
            reset();
            router.refresh();
          }
        }
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        id ? (
          <Button variant="outline" size="sm" className="h-7 text-xs border-[#D6DED2] rounded-lg hover:bg-[#F7F8F3]/50">{t("vendor_form.edit_btn")}</Button>
        ) : (
          <Button className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4">
            <Plus className="mr-2 h-4 w-4" />
            {t("vendor_form.add_btn")}
          </Button>
        )
      } />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                <Truck className="h-5 w-5 text-[#4F6F52]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">{id ? t("vendor_form.edit_title") : t("vendor_form.add_title")}</DialogTitle>
                <DialogDescription className="text-xs text-[#66736A] mt-1">
                  {id ? t("vendor_form.edit_desc") : t("vendor_form.add_desc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-[#243028]">{t("vendor_form.name")} <span className="text-red-500">*</span></Label>
            <Input id="name" required {...register("name")} placeholder={t("vendor_form.name_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-[#243028]">{t("vendor_form.phone")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
              <Input id="phone" {...register("phone")} placeholder={t("vendor_form.phone_placeholder")} className="font-mono bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[#243028]">{t("vendor_form.email")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
              <Input id="email" type="email" {...register("email")} placeholder={t("vendor_form.email_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message as string}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="legalDocNumber" className="text-xs font-semibold text-[#243028]">{t("vendor_form.legal")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
            <Input id="legalDocNumber" {...register("legalDocNumber")} placeholder={t("vendor_form.legal_placeholder")} className="font-mono bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all tabular-nums" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs font-semibold text-[#243028]">{t("vendor_form.address")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
            <Input id="address" {...register("address")} placeholder={t("vendor_form.address_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-[#243028]">{t("vendor_form.status")}</Label>
            <Select 
              value={watch("status") ?? ""} 
              onValueChange={(val) => setValue("status", val as VendorInput["status"])}
              required
            >
              <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-[#8FAF9A]/20 h-9 px-3 transition-premium">
                <SelectValue placeholder="Pilih status">
                  {(() => {
                    const val = watch("status");
                    return val ? (t(`vendor_form.status_${val}`) || VENDOR_STATUS_LABELS[val] || val) : undefined;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                <SelectItem value="active" className="text-xs">{t("vendor_form.status_active")}</SelectItem>
                <SelectItem value="inactive" className="text-xs">{t("vendor_form.status_inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-[#D6DED2] mt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50">
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t("vendor_form.saving") : t("vendor_form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Modal Credential — hanya tampil SATU KALI */}
    <Dialog
      open={!!credential}
      onOpenChange={() => {
        setCredential(null);
        setOpen(false);
        reset();
        router.refresh();
      }}
    >
      <DialogContent className="sm:max-w-md rounded-2xl border border-[#D6DED2] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-[#243028]">
                  Akun Vendor Berhasil Dibuat
                </DialogTitle>
                <p className="text-xs text-[#66736A] mt-0.5">
                  Password hanya tampil satu kali. Salin sekarang.
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3 p-4 bg-[#F7F8F3] rounded-xl border border-[#D6DED2]">
            <div>
              <p className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider mb-1">
                Email Login
              </p>
              <p className="font-mono text-sm font-semibold text-[#243028]">
                {credential?.email}
              </p>
            </div>
            <div className="border-t border-[#D6DED2]/50 pt-3">
              <p className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider mb-1 flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> Password Sementara
              </p>
              <p className="font-mono text-sm font-bold text-[#243028] tracking-wider">
                {credential?.tempPassword}
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 font-semibold leading-relaxed">
              ⚠️ Berikan credential ini kepada vendor. Vendor disarankan segera
              mengganti password setelah login pertama.
            </p>
          </div>

          <Button
            onClick={handleCopy}
            className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white rounded-xl text-xs font-bold h-9 gap-2"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Tersalin!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Salin Credential
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
