"use client";

import { useTransition, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerSchema, type CustomerInput } from "@/server/validators/master";
import { createCustomer, updateCustomer } from "@/server/actions/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, AlertCircle, Loader2 } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { z } from "zod";

const CUSTOMER_SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk in",
  ads: "Iklan",
  social_media: "Sosial Media",
  referral: "Referral",
  website: "Website",
  other: "Lainnya",
};

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  prospect: "Prospek",
  booking: "Booking",
  kpr_process: "Proses KPR",
  akad: "Akad",
  buyer: "Pembeli",
  cancelled: "Batal",
};

const formSchema = customerSchema.extend({
  status: z.string(),
});

export function CustomerForm({ 
  initialData, 
  id,
  originalStatus,
  paymentScheme,
}: { 
  initialData?: CustomerInput; 
  id?: string;
  originalStatus?: string | null;
  paymentScheme?: string | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      nik: "",
      phone: "",
      email: "",
      address: "",
      source: "other",
      status: "prospect",
    },
  });
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = form;

  const nikValue = watch("nik") || "";

  // Reset form when initialData changes or when dialog opens
  useEffect(() => {
    if (open) {
      reset(initialData || {
        name: "",
        nik: "",
        phone: "",
        email: "",
        address: "",
        source: "other",
        status: "prospect",
      });
    }
  }, [initialData, open, reset]);

  // Decode Indonesian NIK elements for dynamic preview
  const parseNik = (nik: string) => {
    if (!/^\d{16}$/.test(nik)) return null;
    const provCode = nik.substring(0, 2);
    
    let day = parseInt(nik.substring(6, 8), 10);
    const month = nik.substring(8, 10);
    const year = nik.substring(10, 12);
    
    const gender = day > 40 ? "Perempuan" : "Laki-laki";
    if (day > 40) day -= 40;
    
    const dob = `${String(day).padStart(2, '0')}/${month}/19${year}`;
    
    const provMap: Record<string, string> = {
      "11": "Aceh", "12": "Sumatera Utara", "13": "Sumatera Barat", "14": "Riau", "15": "Jambi",
      "16": "Sumatera Selatan", "17": "Bengkulu", "18": "Lampung", "19": "Bangka Belitung",
      "21": "Kepulauan Riau", "31": "DKI Jakarta", "32": "Jawa Barat", "33": "Jawa Tengah",
      "34": "DI Yogyakarta", "35": "Jawa Timur", "36": "Banten", "51": "Bali", "52": "Nusa Tenggara Barat",
      "53": "Nusa Tenggara Timur", "61": "Kalimantan Barat", "62": "Kalimantan Tengah",
      "63": "Kalimantan Selatan", "64": "Kalimantan Timur", "71": "Sulawesi Utara",
      "72": "Sulawesi Tengah", "73": "Sulawesi Selatan", "74": "Sulawesi Tenggara", "81": "Maluku",
      "82": "Maluku Utara", "91": "Papua Barat", "94": "Papua"
    };
    
    const province = provMap[provCode] || `Provinsi (Kode ${provCode})`;
    
    return { province, gender, dob };
  };
  
  const parsedNik = parseNik(nikValue);

  const onSubmit = (data: any) => {
    // If editing and status is dynamic, map it back to originalStatus
    const submittedData = { ...data };
    if (id && originalStatus) {
      if (data.status !== "cancelled" && data.status !== "prospect") {
        submittedData.status = originalStatus;
      }
    }
    
    startTransition(async () => {
      setError(null);
      try {
        if (id) {
          await updateCustomer(id, submittedData);
          alert("Data konsumen berhasil diperbarui!");
        } else {
          await createCustomer(submittedData);
          alert("Data konsumen berhasil disimpan!");
        }
        setOpen(false);
        if (!id) reset();
        window.location.reload();
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  const getStatusLabel = (status: string, scheme?: string | null) => {
    const isKpr = scheme === "kpr";
    if (status === "under_constructor") {
      return isKpr ? "Pembeli KPR - Unit Sedang Pembangunan" : "Pembeli - Unit Sedang Pembangunan";
    }
    if (status === "buyer") {
      return isKpr ? "Pembeli KPR - Sukses" : "Pembeli - Sukses";
    }
    if (status === "akad") {
      return isKpr ? "Pembeli KPR - Proses Akad" : "Pembeli - Akad";
    }
    if (status === "kpr_process") {
      return "Proses KPR";
    }
    if (status === "booking") {
      return "Booking";
    }
    if (status === "prospect") {
      return "Konsumen Baru";
    }
    if (status === "cancelled") {
      return "Batal";
    }
    return CUSTOMER_STATUS_LABELS[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        id ? (
          <Button variant="outline" size="sm" className="h-7 text-xs border-[#D6DED2] rounded-lg hover:bg-[#F7F8F3]/50">{t("cust_form.edit_btn")}</Button>
        ) : (
          <Button className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4">
            <Plus className="mr-2 h-4 w-4" />
            {t("cust_form.add_btn")}
          </Button>
        )
      } />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                <Users className="h-5 w-5 text-[#4F6F52]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">{id ? t("cust_form.edit_title") : t("cust_form.add_title")}</DialogTitle>
                <DialogDescription className="text-xs text-[#66736A] mt-1">
                  {id ? t("cust_form.edit_desc") : t("cust_form.add_desc")}
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
            <Label htmlFor="name" className="text-xs font-semibold text-[#243028]">{t("cust_form.name")} <span className="text-red-500">*</span></Label>
            <Input id="name" required {...register("name")} placeholder={t("cust_form.name_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nik" className="text-xs font-semibold text-[#243028]">{t("cust_form.nik")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
            <div className="relative">
              <Input 
                id="nik" 
                {...register("nik")} 
                maxLength={16}
                placeholder={t("cust_form.nik_placeholder")} 
                className="font-mono bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all tabular-nums pr-12"
              />
              <div className="absolute right-3 top-2.5 text-[10px] font-semibold text-muted-foreground">
                {nikValue.length}/16
              </div>
            </div>
            {nikValue.length > 0 && (
              <div className="transition-all duration-300 ease-in-out">
                {!/^\d+$/.test(nikValue) ? (
                  <p className="text-[10px] text-red-500 font-medium">{t("cust_form.nik_err_number")}</p>
                ) : nikValue.length < 16 ? (
                  <p className="text-[10px] text-amber-600 font-medium">{t("cust_form.nik_err_wait")}</p>
                ) : parsedNik ? (
                  <div className="mt-2 p-3 bg-[#DDE8D8]/20 border border-[#8FAF9A]/20 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between items-center text-primary font-bold">
                      <span>{t("cust_form.nik_valid_title")}</span>
                      <span className="bg-[#4F6F52] text-white text-[9px] px-1.5 py-0.5 rounded-full">{t("cust_form.nik_sys")}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[#4F6F52] font-semibold pt-1">
                      <div>{t("cust_form.nik_prov")} <span className="text-foreground font-bold">{parsedNik.province}</span></div>
                      <div>{t("cust_form.nik_gender")} <span className="text-foreground font-bold">{parsedNik.gender}</span></div>
                      <div className="col-span-2">{t("cust_form.nik_dob")} <span className="text-foreground font-bold">{parsedNik.dob}</span></div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-red-500 font-medium">{t("cust_form.nik_err_format")}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-semibold text-[#243028]">{t("cust_form.phone")} <span className="text-red-500">*</span></Label>
            <Input id="phone" required {...register("phone")} placeholder={t("cust_form.phone_placeholder")} className="font-mono bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all tabular-nums" />
            {errors.phone && <p className="text-xs text-red-500">{errors.phone.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-[#243028]">{t("cust_form.email")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
            <Input id="email" type="email" {...register("email")} placeholder={t("cust_form.email_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs font-semibold text-[#243028]">{t("cust_form.address")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
            <Input id="address" {...register("address")} placeholder={t("cust_form.address_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="source" className="text-xs font-semibold text-[#243028]">{t("cust_form.source")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
              <Select 
                value={watch("source") ?? ""} 
                onValueChange={(val) => setValue("source", val as CustomerInput["source"])}
              >
                <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-[#8FAF9A]/20 h-9 px-3 transition-premium">
                  <SelectValue placeholder="Pilih...">
                    {(() => {
                      const val = watch("source");
                      return val ? (CUSTOMER_SOURCE_LABELS[val] || val) : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                  <SelectItem value="walk_in" className="text-xs">{t("cust_form.source_walk_in")}</SelectItem>
                  <SelectItem value="ads" className="text-xs">{t("cust_form.source_ads")}</SelectItem>
                  <SelectItem value="social_media" className="text-xs">{t("cust_form.source_social_media")}</SelectItem>
                  <SelectItem value="referral" className="text-xs">{t("cust_form.source_referral")}</SelectItem>
                  <SelectItem value="website" className="text-xs">{t("cust_form.source_website")}</SelectItem>
                  <SelectItem value="other" className="text-xs">{t("cust_form.source_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-semibold text-[#243028]">{t("cust_form.status")} <span className="text-red-500">*</span></Label>
              <Select 
                value={watch("status") ?? ""} 
                onValueChange={(val) => setValue("status", val as any)}
                required
                disabled={!id}
              >
                <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-[#8FAF9A]/20 h-9 px-3 transition-premium">
                  <SelectValue placeholder="Pilih...">
                    {(() => {
                      const val = watch("status");
                      return val ? getStatusLabel(val, paymentScheme) : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                  {!id ? (
                    <SelectItem value="prospect" className="text-xs">Konsumen Baru</SelectItem>
                  ) : (
                    <>
                      {/* Option for current status */}
                      <SelectItem value={initialData?.status || "prospect"} className="text-xs">
                        {getStatusLabel(initialData?.status || "prospect", paymentScheme)}
                      </SelectItem>
                      
                      {/* If current is prospect or cancelled, we allow toggling between prospect and cancelled */}
                      {(initialData?.status === "prospect" || initialData?.status === "cancelled") && (
                        <SelectItem value={initialData?.status === "prospect" ? "cancelled" : "prospect"} className="text-xs">
                          {initialData?.status === "prospect" ? "Batal" : "Konsumen Baru"}
                        </SelectItem>
                      )}

                      {/* If current status is dynamic (not prospect/cancelled), we allow Batal (cancelled) as option */}
                      {initialData?.status !== "prospect" && initialData?.status !== "cancelled" && (
                        <SelectItem value="cancelled" className="text-xs">
                          Batal
                        </SelectItem>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-[#D6DED2] mt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50">
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t("cust_form.saving") : t("cust_form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
