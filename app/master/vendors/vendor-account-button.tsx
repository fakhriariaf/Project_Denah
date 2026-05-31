"use client";

import { useState, useTransition } from "react";
import { provisionVendorAccount } from "@/server/actions/master";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus, Copy, CheckCircle2, Loader2, AlertCircle, KeyRound } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";

interface VendorAccountButtonProps {
  vendorId: string;
  hasEmail: boolean;
}

export function VendorAccountButton({ vendorId, hasEmail }: VendorAccountButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [credential, setCredential] = useState<{
    email: string;
    tempPassword: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleProvision = () => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await provisionVendorAccount(vendorId);
        if (result.accountCreated) {
          setCredential({ email: result.email, tempPassword: result.tempPassword! });
        }
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  const handleCopy = () => {
    if (!credential) return;
    navigator.clipboard.writeText(
      `Email: ${credential.email}\nPassword Sementara: ${credential.tempPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasEmail || isPending}
        onClick={handleProvision}
        title={!hasEmail ? "Tambahkan email vendor terlebih dahulu" : "Buat akun login vendor"}
        className="h-7 text-xs border-[#D6DED2] rounded-lg hover:bg-[#DDE8D8]/50 gap-1.5"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <UserPlus className="h-3 w-3" />
        )}
        Buat Akun
      </Button>

      {error && (
        <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}

      {/* Modal Credential — hanya tampil SATU KALI */}
      <Dialog
        open={!!credential}
        onOpenChange={() => {
          setCredential(null);
          window.location.reload();
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border border-[#D6DED2] p-0 overflow-hidden">
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
