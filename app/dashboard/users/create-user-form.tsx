"use client";
import { useRouter } from "next/navigation";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createUser } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";

const schema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  roleId: z.string().min(1, "Role wajib dipilih"),
});
type FormValues = z.infer<typeof schema>;

type RoleOption = { id: string; name: string };

export function CreateUserForm({ roles }: { roles: RoleOption[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleId: "",
    },
  });

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      setError(null);
      try {
        await createUser(data);
        alert("Pengguna baru berhasil dibuat!");
        setOpen(false);
        reset();
        router.refresh();
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <Button className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4">
          <UserPlus className="mr-2 h-4 w-4" />
          {t("users.btn_create")}
        </Button>
      } />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                <UserPlus className="h-5 w-5 text-[#4F6F52]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">{t("users.create_title")}</DialogTitle>
                <DialogDescription className="text-xs text-[#66736A] mt-1">
                  {t("users.create_desc")}
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
            <Label htmlFor="name" className="text-xs font-semibold text-[#243028]">{t("users.label_name")} <span className="text-red-500">*</span></Label>
            <Input 
              id="name" 
              required
              {...register("name")} 
              placeholder={t("users.ph_name")} 
              className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-[#243028]">{t("users.label_email")} <span className="text-red-500">*</span></Label>
            <Input 
              id="email" 
              type="email" 
              required
              {...register("email")} 
              placeholder={t("users.ph_email")} 
              className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-[#243028]">{t("users.label_pwd")} <span className="text-red-500">*</span></Label>
            <Input 
              id="password" 
              type="password" 
              required
              {...register("password")} 
              placeholder="Min. 8" 
              className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#243028]">{t("users.label_role")} <span className="text-red-500">*</span></Label>
            <Select 
              value={watch("roleId") ?? ""} 
              onValueChange={(v) => setValue("roleId", v ?? "")}
              required
            >
              <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-[#8FAF9A]/20 h-9 px-3 transition-premium">
                <SelectValue placeholder={t("users.label_role")}>
                  {watch("roleId") ? roles.find(r => r.id === watch("roleId"))?.name.replace(/_/g, " ") : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.name.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roleId && <p className="text-xs text-red-500 mt-1">{errors.roleId.message}</p>}
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-[#D6DED2] mt-2">
            <Button 
              type="button"  
              variant="outline" 
              onClick={() => setOpen(false)}
              className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50"
            >
              {t("action.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isPending} 
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t("users.create_submitting") : t("users.create_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
