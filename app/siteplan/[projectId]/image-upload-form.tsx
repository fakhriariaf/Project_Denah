"use client";

import { useState, useTransition, useRef } from "react";
import { updateSiteplanImage, deleteSiteplan, updateSiteplanPublicStatus } from "@/server/actions/siteplan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageIcon, Link2, Save, Upload, X, FileImage, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export function ImageUploadForm({
  siteplanId,
  currentImageUrl,
  currentPublicEnabled = false,
}: {
  siteplanId: string;
  currentImageUrl?: string | null;
  currentPublicEnabled?: boolean;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState(currentImageUrl ?? "");
  const [publicEnabled, setPublicEnabled] = useState(currentPublicEnabled);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveUrl = () => {
    startTransition(async () => {
      setError(null);
      setSaved(false);
      try {
        await updateSiteplanImage(siteplanId, url);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    // Use createObjectURL instead of readAsDataURL to prevent browser freezing on large files
    if (previewFile && previewFile.startsWith('blob:')) {
      URL.revokeObjectURL(previewFile);
    }
    setPreviewFile(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(t("siteplan_settings.uploading"));
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      
      if (!res.ok) {
        let errMsg = t("siteplan_settings.upload_fail");
        try {
          const errJson = await res.json() as { error?: string };
          errMsg = errJson.error ?? errMsg;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(t("siteplan_settings.invalid_json"));
      }

      const json = await res.json() as { url?: string; error?: string };

      if (json.error) throw new Error(json.error);

      const uploadedUrl = json.url!;
      setUploadProgress(t("siteplan_settings.saving_url"));
      await updateSiteplanImage(siteplanId, uploadedUrl);

      setUrl(uploadedUrl);
      setPreviewFile(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(parseServerError(err));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteBackground = () => {
    if (!confirm(t("siteplan_settings.confirm_del_bg"))) return;
    startTransition(async () => {
      setError(null);
      try {
        await updateSiteplanImage(siteplanId, null);
        setUrl("");
        setPreviewFile(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  const handleDeleteSiteplan = () => {
    const confirm1 = confirm(t("siteplan_settings.confirm_del_siteplan"));
    if (!confirm1) return;

    const confirm2 = typeof window !== "undefined" ? prompt(t("siteplan_settings.confirm_del_prompt")) : null;
    if (confirm2 !== "SETUJU" && confirm2 !== "AGREE") {
      alert(t("siteplan_settings.cancel_wrong_word"));
      return;
    }

    startTransition(async () => {
      setError(null);
      try {
        await deleteSiteplan(siteplanId);
        // Page will refresh and direct upload zone will show up
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  const currentPreview = previewFile ?? (url || null);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          {t("siteplan_settings.bg_title")}
        </CardTitle>
        <CardDescription>
          {t("siteplan_settings.bg_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Public Access Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-[#F7F8F3] rounded-2xl border border-[#D6DED2] mb-4">
          <div className="space-y-0.5">
            <Label htmlFor="public-siteplan-toggle" className="text-xs font-bold text-[#243028] cursor-pointer">
              Tampilkan Publik (Siteplan View)
            </Label>
            <p className="text-[10px] text-[#66736A] font-medium leading-tight">
              Izinkan denah/siteplan ini diakses oleh calon konsumen di halaman publik.
            </p>
          </div>
          <input
            id="public-siteplan-toggle"
            type="checkbox"
            checked={publicEnabled}
            disabled={isPending}
            onChange={async (e) => {
              const val = e.target.checked;
              setPublicEnabled(val);
              startTransition(async () => {
                try {
                  await updateSiteplanPublicStatus(siteplanId, val);
                  toast.success(`Akses publik siteplan berhasil ${val ? "diaktifkan" : "dinonaktifkan"}!`);
                } catch (err) {
                  setPublicEnabled(!val);
                  toast.error(parseServerError(err));
                }
              });
            }}
            className="w-5 h-5 rounded-lg border-[#D6DED2] text-[#4F6F52] focus:ring-ring rounded cursor-pointer accent-[#4F6F52]"
          />
        </div>

        <Separator className="bg-[#D6DED2]/40 my-4" />

        <Tabs defaultValue="upload">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1 gap-1.5">
              <Upload className="h-3.5 w-3.5" /> {t("siteplan_settings.tab_upload")}
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> {t("siteplan_settings.tab_url")}
            </TabsTrigger>
          </TabsList>

          {/* Tab Upload File */}
          <TabsContent value="upload" className="mt-4 space-y-3">
            {/* Dropzone */}
            <div
              className="relative rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-[#4F6F52]/60 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileImage className="h-8 w-8 text-[#4F6F52]" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    className="ml-auto text-muted-foreground hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">{t("siteplan_settings.click_to_select")}</p>
                  <p className="text-xs text-muted-foreground">{t("siteplan_settings.format_info")}</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileChange}
              />
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            {uploading && (
              <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1e293b] text-white p-6 sm:p-12 animate-in fade-in duration-200">
                <div className="w-full max-w-md bg-white/10 p-8 rounded-2xl border border-white/20 shadow-2xl flex flex-col items-center justify-center gap-6">
                  <Loader2 className="h-16 w-16 text-emerald-400 animate-spin" />
                  <p className="font-black text-2xl tracking-tight text-center">{t("siteplan_settings.uploading_siteplan")}</p>
                  
                  {uploadProgress && (
                    <div className="w-full space-y-2">
                      <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden shadow-inner">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 to-emerald-300 h-full rounded-full transition-all duration-300 ease-out shadow-glow-sage" 
                          style={{ width: uploadProgress.includes('%') ? uploadProgress : '100%' }}
                        />
                      </div>
                      <p className="text-sm text-emerald-200 font-mono text-center mt-2">{uploadProgress || t("siteplan_settings.please_wait")}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 text-center mt-2">{t("siteplan_settings.dont_close")}</p>
                </div>
              </div>
            )}
            
            {!uploading && (
              <Button
                onClick={handleUpload}
                disabled={!selectedFile}
                className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold h-10"
              >
                <Upload className="mr-2 h-4 w-4" /> {t("siteplan_settings.upload_save")}
              </Button>
            )}
          </TabsContent>

          {/* Tab URL */}
          <TabsContent value="url" className="mt-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="imageUrl">{t("siteplan_settings.image_url")}</Label>
              <div className="flex gap-2">
                <Input
                  id="imageUrl"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-storage.supabase.co/..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveUrl}
                  disabled={isPending}
                  className="bg-[#4F6F52] hover:bg-[#4F6F52]/90 text-white shrink-0"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {isPending ? t("siteplan_settings.saving") : saved ? t("siteplan_settings.saved") : t("action.save")}
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {currentPreview && (
          <div className="rounded-lg border overflow-hidden">
            <p className="text-xs text-muted-foreground p-2 border-b bg-muted/30">
              {t("siteplan_settings.preview_img")}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPreview}
              alt="Preview siteplan"
              className="w-full object-contain max-h-72 bg-checkerboard"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Current URL info & Delete button */}
        {url && !previewFile && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-dashed border-border animate-in fade-in duration-200">
            <p className="text-xs text-muted-foreground break-all">
              {t("siteplan_settings.active_url")} <span className="font-mono">{url}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeleteBackground}
              disabled={isPending}
              className="text-xs font-bold border-rose-200 hover:bg-rose-50 hover:text-rose-600 text-rose-500 h-8 rounded-xl px-3 w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("siteplan_settings.delete_bg")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    {/* ZONA BAHAYA: HAPUS & RESET SITEPLAN */}
    <Card className="border-rose-200 bg-rose-50/20 shadow-sm rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
      <CardHeader className="p-5 pb-3 border-b border-rose-100 bg-rose-50/50">
        <CardTitle className="text-xs font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-rose-600 animate-pulse" />
          {t("siteplan_settings.danger_zone")}
        </CardTitle>
        <CardDescription className="text-[10px] text-rose-600 leading-relaxed mt-1">
          {t("siteplan_settings.danger_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 space-y-4 bg-white/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <h4 className="text-xs font-bold text-slate-800">{t("siteplan_settings.reset_all")}</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-md" dangerouslySetInnerHTML={{ __html: t("siteplan_settings.reset_all_desc").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
          </div>
          
          <Button
            type="button"
            onClick={handleDeleteSiteplan}
            disabled={isPending}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 rounded-xl px-5 shadow-md shadow-rose-600/10 transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95 btn-premium"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("siteplan_settings.deleting")}
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                {t("siteplan_settings.delete_reset")}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
