"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { resetUserPassword } from "@/server/actions/users";
import { parseServerError } from "@/lib/error-parser";

interface ResetPasswordDialogProps {
  userId: string;
  userName: string;
}

export function ResetPasswordDialog({ userId, userName }: ResetPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      try {
        await resetUserPassword(userId, password);
        alert(`Password untuk ${userName} berhasil diubah!`);
        setOpen(false);
        setPassword("");
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg border-[#D6DED2] hover:bg-[#F7F8F3]/50 transition-premium flex items-center justify-center shrink-0 cursor-pointer"
            title="Ubah Password"
          >
            <KeyRound className="h-4 w-4 text-[#4F6F52]" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md rounded-3xl bg-white border border-[#D6DED2] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white border border-[#D6DED2] flex items-center justify-center shadow-sm">
                <KeyRound className="h-5 w-5 text-[#4F6F52]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-[#243028] tracking-tight">
                  Ubah Password Pengguna
                </DialogTitle>
                <DialogDescription className="text-xs text-[#66736A] mt-1">
                  Atur ulang password untuk akun <strong>{userName}</strong>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-semibold text-[#243028]">
              Password Baru <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 pr-10 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-[#D6DED2] mt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isPending || password.length < 8}
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2 cursor-pointer"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
