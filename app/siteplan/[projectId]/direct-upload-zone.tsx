"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSiteplan } from "@/server/actions/siteplan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileImage, Loader2, X, Sparkles, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function DirectUploadZone({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewFile(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadAndCreate = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(t("siteplan_upload.analyzing"));
    setError(null);

    try {
      // 1. Detect image natural width and height on client side
      const img = new Image();
      img.src = previewFile!;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error(t("siteplan_upload.fail_dim")));
      });

      const width = img.naturalWidth || 1000;
      const height = img.naturalHeight || 750;

      setUploadProgress(t("siteplan_upload.uploading_cloud"));

      // 2. Upload file
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      
      if (!res.ok) {
        let errMsg = t("siteplan_upload.upload_fail");
        try {
          const errJson = await res.json() as { error?: string };
          errMsg = errJson.error ?? errMsg;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }

      const json = await res.json() as { url?: string; error?: string };
      if (json.error) throw new Error(json.error);

      const uploadedUrl = json.url!;

      setUploadProgress(t("siteplan_upload.init_db"));

      // 3. Create siteplan in database
      startTransition(async () => {
        try {
          await createSiteplan({
            projectId,
            name: "Denah Siteplan Utama",
            width,
            height,
            imageUrl: uploadedUrl,
          });
          
          setUploadProgress(t("siteplan_upload.prepare_ai"));
          // Redirect/refresh with scan=true to trigger automatic layout detection
          router.push(`/siteplan/${projectId}?scan=true`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : t("siteplan_upload.fail_init"));
          setUploading(false);
          setUploadProgress(null);
        }
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : t("siteplan_upload.upload_fail"));
      setUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <Card className="border border-[#D6DED2] bg-white/80 backdrop-blur-md shadow-sage-lg rounded-3xl max-w-2xl mx-auto overflow-hidden animate-in fade-in duration-300">
      <CardHeader className="pb-4 text-center bg-gradient-to-b from-[#DDE8D8]/30 to-transparent pt-8">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center shadow-inner mb-3">
          <Upload className="h-6 w-6 animate-pulse" />
        </div>
        <CardTitle className="text-xl font-extrabold text-[#243028]">{t("siteplan_upload.title")}</CardTitle>
        <CardDescription className="text-xs text-[#66736A] max-w-md mx-auto leading-relaxed">
          {t("siteplan_upload.desc")}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 pt-0 space-y-5">
        <div
          className={`relative rounded-2xl border-2 border-dashed border-[#D6DED2] p-8 text-center transition-all ${
            selectedFile ? "bg-[#F7F8F3]/50 border-[#8FAF9A]" : "hover:border-[#4F6F52]/60 hover:bg-[#F7F8F3]/20 cursor-pointer"
          }`}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <FileImage className="h-12 w-12 text-[#4F6F52]" />
              <div className="text-center">
                <p className="text-sm font-bold text-[#243028] max-w-xs truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-mono font-bold text-muted-foreground mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB • WebP, PNG, JPG, SVG
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="mt-2 text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-50 px-3 py-1 rounded-lg border border-rose-100 flex items-center gap-1 transition-all active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
                {t("siteplan_upload.replace")}
              </button>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <Upload className="mx-auto h-10 w-10 text-[#8FAF9A]" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#243028]">{t("siteplan_upload.drag_drop")}</p>
                <p className="text-[10px] text-muted-foreground">{t("siteplan_upload.format")}</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={!!selectedFile}
            onChange={handleFileChange}
          />
        </div>

        {error && (
          <div className="text-red-500 text-xs bg-red-50 border border-red-100 p-3 rounded-xl font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            {error}
          </div>
        )}

        {uploadProgress && (
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground bg-[#F7F8F3] border border-[#D6DED2]/50 p-3 rounded-xl font-bold animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-[#4F6F52]" />
            <span>{uploadProgress}</span>
          </div>
        )}

        <Button
          onClick={handleUploadAndCreate}
          disabled={!selectedFile || uploading || isPending}
          className="w-full h-11 bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold rounded-2xl text-xs shadow-glow-sage transition-all flex items-center justify-center gap-2 btn-premium"
        >
          {uploading || isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("siteplan_upload.processing")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("siteplan_upload.upload_btn")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
