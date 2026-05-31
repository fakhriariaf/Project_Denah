"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { changeOwnPassword } from "@/server/actions/users";
import { parseServerError } from "@/lib/error-parser";

interface ChangePasswordFormProps {
  userId: string;
}

export function ChangePasswordForm({ userId }: ChangePasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Konfirmasi password baru tidak cocok!" });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: "error", text: "Password minimal 8 karakter!" });
      return;
    }

    startTransition(async () => {
      setMessage(null);
      try {
        await changeOwnPassword(password);
        setMessage({
          type: "success",
          text: "Password berhasil diubah! Anda akan dialihkan ke halaman login...",
        });
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } catch (err) {
        setMessage({ type: "error", text: parseServerError(err) });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {message.type === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="own-new-password">Password Baru</Label>
        <div className="relative">
          <Input
            id="own-new-password"
            type={showPassword ? "text" : "password"}
            required
            disabled={isPending}
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

      <div className="space-y-1.5">
        <Label htmlFor="own-confirm-password">Konfirmasi Password Baru</Label>
        <div className="relative">
          <Input
            id="own-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            required
            disabled={isPending}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password baru"
            className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 pr-10 focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending || password.length < 8 || confirmPassword.length < 8}
        className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2 cursor-pointer w-full md:w-auto"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Menyimpan...
          </>
        ) : (
          "Ubah Password"
        )}
      </Button>
    </form>
  );
}
