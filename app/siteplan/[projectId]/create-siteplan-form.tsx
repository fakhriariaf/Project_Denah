"use client";
import { useRouter } from "next/navigation";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { siteplanSchema } from "@/server/validators/siteplan";
import { createSiteplan } from "@/server/actions/siteplan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, X, FileUp, AlertCircle } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { toast } from "sonner";

export function CreateSiteplanForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(siteplanSchema),
    defaultValues: {
      projectId,
      name: "Denah Siteplan Utama",
      width: 1000,
      height: 750,
    },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  const onSubmit = (data: { projectId: string; name: string; width: number; height: number }) => {
    startTransition(async () => {
      setError(null);
      try {
        await createSiteplan(data);
        toast.success("Gambar siteplan berhasil disimpan!");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <Button className="bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs font-bold rounded-xl h-9 px-4 transition-all duration-300 btn-premium flex items-center gap-1.5 active:scale-95">
          <Plus className="h-4 w-4 shrink-0" />
          <span>Buat Denah Siteplan</span>
        </Button>
      } />
      
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-black text-[#243028] flex items-center gap-2 tracking-tight">
              <div className="h-7 w-7 rounded-lg bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center shadow-inner">
                <FileUp className="h-4 w-4" />
              </div>
              <span>Buat Siteplan Baru</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#66736A] mt-1.5 leading-relaxed">
              Konfigurasikan dimensi dasar kanvas gambar koordinat siteplan proyek perumahan Anda.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 pt-3 text-xs font-semibold overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          
          <input type="hidden" {...register("projectId")} />

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-bold text-[#243028]">Nama Identitas Siteplan <span className="text-red-500">*</span></Label>
            <Input 
              id="name" 
              required
              {...register("name")} 
              placeholder="Contoh: Denah Blok A & B" 
              className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-ring input-premium text-[#243028]"
            />
            {errors.name && (
              <p className="text-[10px] text-red-500 font-bold mt-1 pl-1">
                {errors.name.message as string}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="width" className="text-xs font-bold text-[#243028]">Lebar Kanvas (px) <span className="text-red-500">*</span></Label>
              <Input 
                id="width" 
                type="number" 
                required
                {...register("width", { valueAsNumber: true })} 
                className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-ring font-mono tabular-nums text-[#243028]"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="height" className="text-xs font-bold text-[#243028]">Tinggi Kanvas (px) <span className="text-red-500">*</span></Label>
              <Input 
                id="height" 
                type="number" 
                required
                {...register("height", { valueAsNumber: true })} 
                className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-ring font-mono tabular-nums text-[#243028]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#D6DED2]/40 mt-6">
            <Button 
              variant="outline" 
              type="button" 
              onClick={() => setOpen(false)}
              className="text-xs border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3] h-9.5 rounded-xl font-bold px-4"
            >
              Batal
            </Button>
            <Button 
              type="submit" 
              disabled={isPending} 
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs h-9.5 rounded-xl font-bold shadow-glow-sage px-4 btn-premium flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              {isPending ? "Memproses..." : "Buat Denah"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
