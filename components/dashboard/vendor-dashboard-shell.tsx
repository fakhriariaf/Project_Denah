"use client";

import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Home, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Plus, 
  Upload, 
  Loader2, 
  CheckCircle,
  FileCheck,
  AlertCircle,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  ClipboardList,
  TrendingUp,
  Camera,
  MessageSquare,
  HardHat,
  XCircle
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { 
  inputProgress, 
  uploadProgressPhotoAttachment, 
  uploadBastAttachment, 
  createVendorComplaint,
  getSpkDetails 
} from "@/server/actions/production";
import { useRouter } from "next/navigation";

const SPK_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  proses_konstruksi: "Proses Konstruksi",
  selesai_konstruksi: "Selesai Konstruksi",
  overdue: "Terlambat",
  completed: "Selesai",
  cancelled: "Batal",
  draft: "Draft",
};

interface VendorDashboardShellProps {
  data: {
    vendorProfile: any;
    metrics: {
      activeSpks: number;
      unitsBuilding: number;
      needUpdate: number;
      overdueSpks: number;
      readyBast: number;
    };
    spks: Array<{
      id: string;
      spkNumber: string;
      title: string;
      projectName: string;
      unitId: string;
      unitCode: string;
      currentCustomerId: string | null;
      progressPct: number;
      startDate: Date;
      targetEndDate: Date;
      status: string;
    }>;
    recentLogs: Array<{
      id: string;
      spkNumber: string;
      workItemName: string;
      percentageAdded: number;
      currentTotalPct: number;
      progressDate: Date;
      notes: string | null;
      creatorName: string;
    }>;
    complaints: Array<{
      id: string;
      complaintNumber: string;
      customerName: string;
      unitCode: string;
      projectName: string;
      category: string;
      description: string;
      status: string;
      createdAt: Date;
    }>;
    basts: Array<{
      spkId: string;
      spkNumber: string;
      unitCode: string;
      projectName: string;
      statusText: string;
      statusCode: string;
      attachmentUrl: string | null;
      attachmentName: string | null;
      uploadedAt: Date | null;
    }>;
  };
  userName: string;
}

export function VendorDashboardShell({ data, userName }: VendorDashboardShellProps) {
  const router = useRouter();
  const { metrics, spks, recentLogs, complaints, basts, vendorProfile } = data;

  const complaintsByProject = React.useMemo(() => {
    const groups: Record<string, typeof complaints> = {};
    for (const c of complaints) {
      const projName = c.projectName || "Lain-Lain";
      if (!groups[projName]) {
        groups[projName] = [];
      }
      groups[projName].push(c);
    }
    return groups;
  }, [complaints]);

  // Active Dialog States
  const [activeDialog, setActiveDialog] = useState<"progress" | "complaint" | "bast" | null>(null);
  
  // Loading states
  const [submitting, setSubmitting] = useState(false);
  const [loadingSpkDetails, setLoadingSpkDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form States - Progress
  const [progSpkId, setProgSpkId] = useState("");
  const [progWorkItems, setProgWorkItems] = useState<any[]>([]);
  const [progWorkItemId, setProgWorkItemId] = useState("");
  const [progPctAdded, setProgPctAdded] = useState(5);
  const [progDate, setProgDate] = useState(new Date().toISOString().split("T")[0]);
  const [progNotes, setProgNotes] = useState("");
  const [progFiles, setProgFiles] = useState<File[]>([]);
  const [progUploadedPhotos, setProgUploadedPhotos] = useState<string[]>([]);
  const [progLogs, setProgLogs] = useState<any[]>([]);
  const [uploadingProgressPhoto, setUploadingProgressPhoto] = useState(false);

  // Form States - Complaint
  const [compSpkIndex, setCompSpkIndex] = useState("");
  const [compTitle, setCompTitle] = useState("");
  const [compCategory, setCompCategory] = useState("material");
  const [compDescription, setCompDescription] = useState("");

  // Form States - BAST
  const [bastSpkId, setBastSpkId] = useState("");
  const [bastFile, setBastFile] = useState<File | null>(null);
  const [uploadingBastPdf, setUploadingBastPdf] = useState(false);

  // Fetch SPK details when SPK selection changes in Progress form
  useEffect(() => {
    if (!progSpkId) {
      setProgWorkItems([]);
      setProgLogs([]);
      return;
    }

    async function fetchWorkItems() {
      setLoadingSpkDetails(true);
      setErrorMsg(null);
      try {
        const details = await getSpkDetails(progSpkId);
        if (details) {
          setProgLogs(details.logs || []);
          if (details.weights) {
            // weights structure is { weight: spkWorkItemWeights, workItem: workItems }
            setProgWorkItems(details.weights.map((w: any) => {
              const totalProgress = (details.logs || [])
                .filter((l: any) => l.log.workItemId === w.weight.workItemId)
                .reduce((sum: number, l: any) => sum + l.log.percentageAdded, 0);

              return {
                id: w.workItem.id,
                name: w.workItem.name,
                code: w.workItem.code,
                weight: w.weight.weightPct,
                currentProgress: Math.min(100, totalProgress)
              };
            }));
          }
        }
      } catch (err: any) {
        setErrorMsg("Gagal memuat item pekerjaan untuk SPK ini.");
      } finally {
        setLoadingSpkDetails(false);
      }
    }

    fetchWorkItems();
  }, [progSpkId]);

  if (!vendorProfile || !vendorProfile.vendorId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4 bg-[#F7F8F3] rounded-2xl border border-[#DDE8D8] m-4">
        <div className="h-16 w-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-200">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-black text-[#243028]">Akun Belum Terhubung</h2>
          <p className="text-sm text-[#66736A] mt-2 max-w-sm leading-relaxed">
            Akun Anda belum terhubung dengan data vendor. Silakan hubungi Admin Kantor
            untuk menghubungkan akun Anda dengan master data vendor.
          </p>
        </div>
      </div>
    );
  }

  // Handle progress file upload
  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
 
    try {
      let photoAttachmentId: string | null = null;
      const photoAttachmentIds: string[] = [];
      if (progFiles.length > 0) {
        setUploadingProgressPhoto(true);
        for (const file of progFiles) {
          const formData = new FormData();
          formData.append("file", file);
          
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
 
          if (!uploadRes.ok) throw new Error("Gagal mengunggah foto progress.");
          const uploadData = await uploadRes.json();
          
          // Save attachment
          const attRes = await uploadProgressPhotoAttachment(progSpkId, {
            fileName: file.name,
            fileUrl: uploadData.url,
            mimeType: file.type,
            fileSize: file.size
          });
          if (attRes.success) {
            photoAttachmentIds.push(attRes.attachmentId);
          }
        }
        if (photoAttachmentIds.length > 0) {
          photoAttachmentId = photoAttachmentIds[0];
        }
        setUploadingProgressPhoto(false);
      }
 
      await inputProgress({
        spkId: progSpkId,
        workItemId: progWorkItemId,
        percentageAdded: progPctAdded,
        progressDate: new Date(progDate),
        photoAttachmentId,
        photoAttachmentIds: photoAttachmentIds.length > 0 ? photoAttachmentIds : null,
        notes: progNotes || null
      });
 
      setSuccessMsg("Progress pekerjaan berhasil diperbarui!");
      // Reset form
      setProgSpkId("");
      setProgWorkItemId("");
      setProgPctAdded(5);
      setProgNotes("");
      setProgFiles([]);
      setProgUploadedPhotos([]);
      
      setTimeout(() => {
        setActiveDialog(null);
        setSuccessMsg(null);
        router.refresh();
      }, 1500);
 
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan progress pekerjaan.");
      setUploadingProgressPhoto(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle complaint submit
  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!compTitle.trim()) {
      setErrorMsg("Judul kendala wajib diisi.");
      setSubmitting(false);
      return;
    }

    try {
      const selectedSpk = spks[parseInt(compSpkIndex)];
      if (!selectedSpk) throw new Error("SPK tidak valid");

      await createVendorComplaint({
        spkId: selectedSpk.id,
        title: compTitle,
        category: compCategory as any,
        description: compDescription
      });

      setSuccessMsg("Kendala pekerjaan berhasil dilaporkan!");
      setCompSpkIndex("");
      setCompTitle("");
      setCompDescription("");
      
      setTimeout(() => {
        setActiveDialog(null);
        setSuccessMsg(null);
        router.refresh();
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || "Gagal melaporkan kendala pekerjaan.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle BAST PDF upload
  const handleBastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bastFile) {
      setErrorMsg("Berkas PDF BAST wajib diunggah.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      setUploadingBastPdf(true);
      const formData = new FormData();
      formData.append("file", bastFile);
      
      const uploadRes = await fetch("/api/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Gagal mengunggah berkas PDF BAST.");
      const uploadData = await uploadRes.json();
      
      // Save BAST attachment
      await uploadBastAttachment(bastSpkId, {
        fileName: bastFile.name,
        fileUrl: uploadData.url,
        mimeType: bastFile.type,
        fileSize: bastFile.size
      });

      setUploadingBastPdf(false);
      setSuccessMsg("BAST Vendor berhasil diajukan!");
      setBastSpkId("");
      setBastFile(null);
      
      setTimeout(() => {
        setActiveDialog(null);
        setSuccessMsg(null);
        router.refresh();
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengajukan BAST.");
      setUploadingBastPdf(false);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500 text-white">Aktif</Badge>;
      case "proses_konstruksi":
        return <Badge className="bg-purple-500 text-white">Proses Konstruksi</Badge>;
      case "selesai_konstruksi":
        return <Badge className="bg-[#4F6F52] text-white">Selesai Konstruksi</Badge>;
      case "overdue":
        return <Badge className="bg-[#C87A7A] text-white">Terlambat</Badge>;
      case "completed":
        return <Badge className="bg-[#4F6F52] text-white">Selesai</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Batal</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeSpksList = spks.filter(s => s.status === "proses_konstruksi" || s.status === "overdue");
  const overdueSpksList = spks.filter(s => s.status === "overdue" || (s.status === "proses_konstruksi" && new Date(s.targetEndDate) < new Date()));
  
  // Need progress update list (no update in last 7 days)
  const spkIdsWithRecentLogs = new Set(recentLogs.map(l => l.spkNumber));
  const needUpdateList = activeSpksList.filter(s => s.progressPct < 100 && !spkIdsWithRecentLogs.has(s.spkNumber));

  return (
    <div className="space-y-6 bg-[#F7F8F3] min-h-screen p-1 md:p-4">
      {/* 1. Header Banner */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-[#DDE8D8] p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#2C3E2D]">Portal Vendor & Kontraktor</h1>
          <p className="text-sm text-[#5C6E5D]">
            Selamat datang, <span className="font-semibold text-[#4F6F52]">{userName}</span> (Perusahaan: {vendorProfile?.companyName || "Vendor Kontraktor"})
          </p>
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => { setErrorMsg(null); setActiveDialog("progress"); }}
            className="bg-[#8FAF9A] hover:bg-[#7da089] text-white text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Update Progress
          </Button>
          <Button 
            onClick={() => { setErrorMsg(null); setActiveDialog("complaint"); }}
            className="bg-white hover:bg-slate-50 text-[#4F6F52] border border-[#DDE8D8] text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" /> Laporkan Kendala
          </Button>
          <Button 
            onClick={() => { setErrorMsg(null); setActiveDialog("bast"); }}
            className="bg-[#4F6F52] hover:bg-[#3a523c] text-white text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <FileText className="w-4 h-4" /> Ajukan BAST Vendor
          </Button>
        </div>
      </div>

      {/* 2. Five Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-[#DDE8D8] bg-white/60 backdrop-blur-md rounded-xl hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-[#5C6E5D] font-medium flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-[#8FAF9A]" /> SPK Aktif
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-[#2C3E2D]">{metrics.activeSpks}</div>
          </CardContent>
        </Card>

        <Card className="border-[#DDE8D8] bg-white/60 backdrop-blur-md rounded-xl hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-[#5C6E5D] font-medium flex items-center gap-1">
              <Home className="w-3.5 h-3.5 text-[#8FAF9A]" /> Unit Pembangunan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-[#2C3E2D]">{metrics.unitsBuilding}</div>
          </CardContent>
        </Card>

        <Card className="border-[#DDE8D8] bg-white/60 backdrop-blur-md rounded-xl hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-[#5C6E5D] font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Perlu Update
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-amber-600">{metrics.needUpdate}</div>
          </CardContent>
        </Card>

        <Card className="border-[#DDE8D8] bg-white/60 backdrop-blur-md rounded-xl hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-[#5C6E5D] font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> SPK Terlambat
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-rose-600">{metrics.overdueSpks}</div>
          </CardContent>
        </Card>

        <Card className="border-[#DDE8D8] bg-white/60 backdrop-blur-md rounded-xl hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-[#5C6E5D] font-medium flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-[#4F6F52]" /> Siap BAST
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-[#4F6F52]">{metrics.readyBast}</div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Section 1: SPK / Pekerjaan Aktif */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[#DDE8D8] bg-white/80 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-[#DDE8D8]/50 p-5 bg-[#DDE8D8]/20">
              <CardTitle className="text-base font-bold text-[#2C3E2D] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#4F6F52]" /> SPK & Pekerjaan Aktif
              </CardTitle>
              <CardDescription className="text-xs text-[#5C6E5D]">Daftar seluruh pekerjaan fisik konstruksi aktif Anda.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {activeSpksList.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5C6E5D] italic">Tidak ada SPK aktif saat ini.</div>
              ) : (
                <div className="divide-y divide-[#DDE8D8]/40">
                  {activeSpksList.map((spk) => (
                    <div key={spk.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#4F6F52] bg-[#DDE8D8]/40 px-2 py-0.5 rounded">
                            {spk.spkNumber}
                          </span>
                          <span className="text-xs font-semibold text-[#2C3E2D] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" /> {spk.projectName} &bull; Kav. {spk.unitCode}
                          </span>
                          {getStatusBadge(spk.status)}
                        </div>
                        <h4 className="text-sm font-bold text-[#2C3E2D] pt-0.5">{spk.title}</h4>
                        <div className="text-xs text-muted-foreground flex items-center gap-3 pt-1">
                          <span>Target Selesai: {new Date(spk.targetEndDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 min-w-[150px]">
                        <div className="w-full space-y-1">
                          <div className="flex justify-between text-xs font-bold text-[#2C3E2D]">
                            <span>Progres</span>
                            <span>{spk.progressPct}%</span>
                          </div>
                          <Progress value={spk.progressPct} className="h-2 bg-slate-100" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setErrorMsg(null);
                            setProgSpkId(spk.id);
                            setActiveDialog("progress");
                          }}
                          className="text-[#4F6F52] hover:text-[#3a523c] hover:bg-[#DDE8D8]/30 rounded-xl"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Progress Perlu Update */}
          {needUpdateList.length > 0 && (
            <Card className="border-[#DDE8D8] bg-[#FFFBF0] rounded-2xl shadow-sm overflow-hidden">
              <CardHeader className="border-b border-amber-100 p-5 bg-amber-50/50">
                <CardTitle className="text-base font-bold text-[#8A5A00] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" /> Progress Perlu Update
                </CardTitle>
                <CardDescription className="text-xs text-amber-700">SPK yang tidak memiliki aktivitas pembaruan progress dalam 7 hari terakhir.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-amber-100/50">
                  {needUpdateList.map((spk) => (
                    <div key={spk.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100/60 px-1.5 py-0.5 rounded">
                          {spk.spkNumber}
                        </span>
                        <h4 className="text-sm font-bold text-[#2C3E2D]">{spk.title}</h4>
                        <p className="text-xs text-amber-700">Kavling {spk.unitCode} &bull; Progress saat ini: {spk.progressPct}%</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setErrorMsg(null);
                          setProgSpkId(spk.id);
                          setActiveDialog("progress");
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3 rounded-lg"
                      >
                        Update
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 3: Dokumentasi Lapangan */}
          <Card className="border-[#DDE8D8] bg-white/80 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-[#DDE8D8]/50 p-5 bg-[#DDE8D8]/20">
              <CardTitle className="text-base font-bold text-[#2C3E2D] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#4F6F52]" /> Aktivitas Update Terakhir
              </CardTitle>
              <CardDescription className="text-xs text-[#5C6E5D]">Daftar 10 aktivitas progres terakhir yang Anda laporkan.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {recentLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5C6E5D] italic">Belum ada riwayat aktivitas progres.</div>
              ) : (
                <div className="divide-y divide-[#DDE8D8]/40">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#2C3E2D]">{log.workItemName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">({log.spkNumber})</span>
                        </div>
                        {log.notes && <p className="text-xs text-[#5C6E5D] italic">"{log.notes}"</p>}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <span>Dilaporkan oleh: {log.creatorName}</span>
                          <span>&bull;</span>
                          <span>{new Date(log.progressDate).toLocaleDateString("id-ID", { dateStyle: "short" })}</span>
                        </div>
                      </div>
                      <Badge className="bg-[#DDE8D8] text-[#2C3E2D] hover:bg-[#DDE8D8]/80 text-[10px] font-bold">
                        +{log.percentageAdded}% ({log.currentTotalPct}%)
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column Right: Kendala & BAST */}
        <div className="space-y-6">
          
          {/* Section 4: Kendala Pekerjaan */}
          <Card className="border-[#DDE8D8] bg-white/80 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-[#DDE8D8]/50 p-5 bg-rose-50/30">
              <CardTitle className="text-base font-bold text-[#A94A4A] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" /> Kendala Aktif
              </CardTitle>
              <CardDescription className="text-xs text-[#5C6E5D]">Daftar kendala konstruksi aktif di unit Anda.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {complaints.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5C6E5D] italic">Tidak ada kendala aktif saat ini. Aman!</div>
              ) : (
                <div className="divide-y divide-[#DDE8D8]/30">
                  {Object.entries(complaintsByProject).map(([projName, items]) => (
                    <div key={projName} className="p-4 space-y-3 first:pt-4">
                      <div className="flex items-center gap-2 pb-1 border-b border-[#DDE8D8]/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        <h4 className="text-xs font-bold text-[#2C3E2D] uppercase tracking-wider">{projName}</h4>
                        <span className="text-[10px] font-medium text-[#5C6E5D] bg-[#DDE8D8]/30 px-2 py-0.5 rounded-full">
                          {items.length} Masalah
                        </span>
                      </div>
                      
                      <div className="space-y-3 pl-2">
                        {items.map((c) => (
                          <div key={c.id} className="space-y-2 border-b border-dashed border-[#DDE8D8]/20 last:border-b-0 pb-3 last:pb-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                {c.complaintNumber}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-semibold py-0 px-2 border-amber-300 text-amber-700 bg-amber-50">
                                {c.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-[#2C3E2D]">
                                Kavling {c.unitCode} &bull; <span className="text-primary">{c.category === "quality" ? "Kualitas" : c.category === "delay" ? "Keterlambatan" : c.category === "document" ? "Dokumen" : c.category === "payment" ? "Keuangan" : "Lainnya"}</span>
                              </h5>
                              <p className="text-xs text-[#5C6E5D] leading-relaxed pt-0.5">{c.description}</p>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex justify-between items-center pt-1">
                              <span>Konsumen: <span className="font-semibold text-slate-700">{c.customerName}</span></span>
                              <span>{new Date(c.createdAt).toLocaleDateString("id-ID")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 5: BAST Vendor */}
          <Card className="border-[#DDE8D8] bg-white/80 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-[#DDE8D8]/50 p-5 bg-[#DDE8D8]/20">
              <CardTitle className="text-base font-bold text-[#2C3E2D] flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#4F6F52]" /> Status Pengajuan BAST
              </CardTitle>
              <CardDescription className="text-xs text-[#5C6E5D]">Pemantauan pengajuan BAST untuk SPK yang telah mencapai 100%.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {basts.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5C6E5D] italic">Belum ada unit yang siap diajukan BAST.</div>
              ) : (
                <div className="divide-y divide-[#DDE8D8]/40">
                  {basts.map((b) => (
                    <div key={b.spkId} className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div>
                          <h5 className="text-xs font-bold text-[#2C3E2D]">{b.projectName} &bull; Kav. {b.unitCode}</h5>
                          <span className="font-mono text-[10px] text-muted-foreground">{b.spkNumber}</span>
                        </div>
                        {b.statusCode === "approved" ? (
                          <Badge className="bg-[#4F6F52] text-white">Disetujui</Badge>
                        ) : b.statusCode === "pending" ? (
                          <Badge className="bg-amber-600 text-white">Menunggu Approval</Badge>
                        ) : (
                          <Badge className="bg-gray-400 text-white">Belum Diajukan</Badge>
                        )}
                      </div>

                      {b.statusCode === "not_submitted" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setErrorMsg(null);
                            setBastSpkId(b.spkId);
                            setActiveDialog("bast");
                          }}
                          className="w-full bg-[#8FAF9A] hover:bg-[#7da089] text-white text-xs h-8 rounded-lg flex items-center justify-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" /> Ajukan BAST PDF
                        </Button>
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-[#5C6E5D] font-medium truncate max-w-[150px]">
                            {b.attachmentName || "BAST_Vendor.pdf"}
                          </span>
                          <a
                            href={b.attachmentUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-[#4F6F52] hover:underline"
                          >
                            Buka PDF
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. DIALOG MODALS */}
      {/* ============================================================== */}

      {/* Modal 1: Update Progress */}
      <Dialog open={activeDialog === "progress"} onOpenChange={(open) => {
        if (!open) {
          setActiveDialog(null);
          setProgUploadedPhotos([]);
          setProgFiles([]);
        }
      }}>
        <DialogContent className="w-[95vw] sm:max-w-xl rounded-3xl bg-white border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-[#2C3E2D] font-black tracking-tight text-lg flex items-center gap-2">
                <HardHat className="h-5 w-5 text-[#8FAF9A]" />
                Input Progress Konstruksi
              </DialogTitle>
              <DialogDescription className="text-xs text-[#66736A] mt-1">Laporkan progres harian pekerjaan fisik lapangan.</DialogDescription>
            </DialogHeader>
          </div>

          <Tabs defaultValue="form" className="w-full">
            <div className="px-6 pt-3 border-b border-border bg-[#F7F8F3]/50">
              <TabsList className="grid grid-cols-2 w-full h-9 bg-muted/60 p-0.5 rounded-lg border border-[#D6DED2]">
                <TabsTrigger value="form" className="text-xs font-semibold rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  Catat Progres
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs font-semibold rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  Riwayat & Galeri Foto
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: FORM */}
            <TabsContent value="form" className="m-0 focus-visible:outline-none">
              {(() => {
                const currentSpk = spks.find(s => s.id === progSpkId);
                return (
                  <>
                    {currentSpk && (
                      <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-[#DDE8D8]/60 via-white/80 to-[#DDE8D8]/30 border border-[#D6DED2] rounded-2xl flex items-center justify-between text-xs shadow-sm animate-scale-in border-l-4 border-l-[#4F6F52]">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Nomor SPK Kerja</p>
                          <p className="font-mono font-bold text-[#4F6F52] text-sm">{currentSpk.spkNumber}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Unit / Kavling</p>
                          <p className="font-black text-[#243028] text-sm">{currentSpk.projectName} &bull; Kav. {currentSpk.unitCode}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">Status SPK: <span className="capitalize font-bold text-amber-600">{SPK_STATUS_LABELS[currentSpk.status] || currentSpk.status.replace("_", " ")}</span></p>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleProgressSubmit} className="p-6 space-y-5 pt-4 max-h-[60vh] overflow-y-auto">
                      {errorMsg && (
                        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl flex items-center gap-2 text-xs font-medium">
                          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
                        </div>
                      )}
                      {successMsg && (
                        <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs font-medium">
                          <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label htmlFor="progSpkId" className="font-bold text-[#243028] text-xs">Pilih SPK Pekerjaan</Label>
                        <Select value={progSpkId} onValueChange={(val) => { setProgSpkId(val || ""); setProgWorkItemId(""); }} disabled={submitting}>
                          <SelectTrigger id="progSpkId" className="w-full h-11 border-[#D6DED2] focus:ring-2 focus:ring-[#4F6F52]/20 rounded-xl bg-white/80 backdrop-blur-sm text-xs font-semibold">
                            <SelectValue placeholder="Pilih SPK aktif...">
                              {progSpkId ? (() => {
                                const selectedSpk = spks.find(s => s.id === progSpkId);
                                return selectedSpk ? `${selectedSpk.spkNumber} - Kav. ${selectedSpk.unitCode} (${selectedSpk.progressPct}%)` : progSpkId;
                              })() : undefined}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white/95 border-[#DDE8D8] rounded-xl">
                            {activeSpksList.map((spk) => (
                              <SelectItem key={spk.id} value={spk.id} className="text-xs font-semibold">
                                {spk.spkNumber} - Kav. {spk.unitCode} ({spk.progressPct}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {loadingSpkDetails ? (
                        <div className="py-8 flex justify-center items-center gap-2 text-xs text-[#5C6E5D]">
                          <Loader2 className="w-4 h-4 animate-spin text-[#4F6F52]" /> Memuat item pekerjaan...
                        </div>
                      ) : (
                        progSpkId && (
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <Label htmlFor="progWorkItemId" className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                                <ClipboardList className="h-4 w-4 text-[#8FAF9A]" />
                                Item Pekerjaan
                              </Label>
                              <Select value={progWorkItemId} onValueChange={(val) => setProgWorkItemId(val || "")} disabled={submitting}>
                                <SelectTrigger id="progWorkItemId" className="w-full h-11 border-[#D6DED2] focus:ring-2 focus:ring-[#4F6F52]/20 rounded-xl bg-white/80 backdrop-blur-sm text-xs font-semibold">
                                  <SelectValue placeholder="Pilih item pekerjaan...">
                                    {progWorkItemId ? (() => {
                                      const selectedItem = progWorkItems.find(item => item.id === progWorkItemId);
                                      return selectedItem ? `${selectedItem.name} — Bobot ${selectedItem.weight}% (Progres: ${selectedItem.currentProgress}%)` : progWorkItemId;
                                    })() : undefined}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-white/95 border-[#DDE8D8] rounded-xl">
                                  {progWorkItems.map((item) => (
                                    <SelectItem key={item.id} value={item.id} className="text-xs font-semibold">
                                      {item.name} &mdash; Bobot {item.weight}% (Progres: {item.currentProgress}%)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {progWorkItemId && (() => {
                              const selectedComponent = progWorkItems.find(c => c.id === progWorkItemId);
                              const currentProgressPct = selectedComponent ? selectedComponent.currentProgress : 0;
                              const componentWeightPct = selectedComponent ? selectedComponent.weight : 0;
                              const newTotalProgress = Math.min(100, currentProgressPct + (progPctAdded || 0));
                              const isOverLimit = (currentProgressPct + (progPctAdded || 0)) > 100;

                              return (
                                <div className="space-y-4">
                                  {/* Dynamic Cumulative Progress Visual Indicator */}
                                  <div className="p-4 bg-gradient-to-br from-[#8FAF9A]/5 via-white/40 to-[#8FAF9A]/10 border border-[#8FAF9A]/20 rounded-2xl space-y-3 text-xs shadow-sm animate-scale-in">
                                    <div className="flex justify-between items-center font-bold text-foreground">
                                      <span className="text-[#66736A] font-bold">Status Kemajuan Fisik:</span>
                                      <span className={`font-black text-xs px-2.5 py-0.5 rounded-full ${
                                        isOverLimit 
                                          ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse" 
                                          : "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/25"
                                      }`}>
                                        {isOverLimit 
                                          ? `⚠️ Melebihi Batas! (${currentProgressPct}% + ${progPctAdded}% = ${currentProgressPct + progPctAdded}%)` 
                                          : `${currentProgressPct}% → ${newTotalProgress}%`}
                                      </span>
                                    </div>
                                    
                                    {/* Premium Segmented/Stacked Progress Bar */}
                                    <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-[#D6DED2]/40 shadow-inner">
                                      {/* Current Progress Segment */}
                                      <div 
                                        className="h-full bg-gradient-to-r from-[#4F6F52] to-[#608764] transition-all duration-500 rounded-l-full"
                                        style={{ width: `${currentProgressPct}%` }}
                                      />
                                      {/* New Added Progress Segment */}
                                      <div 
                                        className={`h-full transition-all duration-500 ${isOverLimit ? "bg-red-400 animate-pulse" : "bg-gradient-to-r from-[#8FAF9A] to-[#A3C1AD]"} ${currentProgressPct === 0 ? "rounded-l-full" : ""}`}
                                        style={{ width: `${isOverLimit ? 100 - currentProgressPct : progPctAdded}%` }}
                                      />
                                    </div>
                                    
                                    <div className="flex justify-between text-[10px] text-slate-500 font-bold tracking-wide uppercase">
                                      <span>Progres Terakhir: {currentProgressPct}%</span>
                                      <span>Bobot Relatif: {componentWeightPct}%</span>
                                    </div>
                                  </div>

                                  {/* Range Slider & Presets Card */}
                                  {currentProgressPct === 100 ? (
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-800 shadow-sm animate-scale-in">
                                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                      <div className="space-y-1">
                                        <p className="font-bold">Item Pekerjaan Selesai (100%)</p>
                                        <p className="text-emerald-700/90 font-medium">Komponen pekerjaan ini telah mencapai progress fisik 100% dan telah selesai. Tidak memerlukan tambahan laporan progress lapangan.</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div className="p-4 bg-white/80 backdrop-blur-sm border border-[#D6DED2] rounded-2xl shadow-sm space-y-3.5">
                                        <div className="flex items-center justify-between text-xs font-bold text-[#243028]">
                                          <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-[#8FAF9A]" /> Tambahan Kemajuan Fisik</span>
                                          <div className="flex items-baseline gap-1.5">
                                            {componentWeightPct > 0 && (
                                              <span className="text-[10px] text-[#66736A] font-semibold">
                                                (Dampak Unit: +{((progPctAdded || 0) * componentWeightPct / 100).toFixed(1)}%)
                                              </span>
                                            )}
                                            <span className="text-[#4F6F52] font-black text-base tracking-tight">+{progPctAdded}%</span>
                                          </div>
                                        </div>
                                        <Slider
                                          min={1}
                                          max={Math.max(1, 100 - currentProgressPct)}
                                          step={1}
                                          value={[progPctAdded]}
                                          onValueChange={(val: number[]) => setProgPctAdded(val[0])}
                                          className="py-2 cursor-pointer"
                                        />
                                        
                                        {/* Visual Preset Tap-Friendly Buttons */}
                                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                                          <div className="flex gap-1.5">
                                            {[10, 25, 50].map((preset) => {
                                              const disabled = preset > (100 - currentProgressPct);
                                              return (
                                                <Button
                                                  key={preset}
                                                  type="button"
                                                  variant="outline"
                                                  disabled={disabled}
                                                  className={`text-[10px] font-bold px-3 py-1 h-7 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                                                    progPctAdded === preset
                                                      ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-sm"
                                                      : "border-[#D6DED2] text-[#4F6F52] hover:bg-[#8FAF9A]/10 hover:border-[#8FAF9A]/40 bg-white"
                                                  }`}
                                                  onClick={() => setProgPctAdded(preset)}
                                                >
                                                  +{preset}%
                                                </Button>
                                              );
                                            })}
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className={`text-[10px] font-black px-3.5 py-1 h-7 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
                                                progPctAdded === Math.max(1, 100 - currentProgressPct)
                                                  ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-sm"
                                                  : "border-[#4F6F52]/50 text-[#4F6F52] hover:bg-[#4F6F52]/10 bg-white"
                                              }`}
                                              onClick={() => setProgPctAdded(Math.max(1, 100 - currentProgressPct))}
                                            >
                                              Set 100%
                                            </Button>
                                          </div>
                                          
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="text-[10px] font-bold px-3 py-1 h-7 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-400 bg-white transition-all duration-200 hover:scale-105 active:scale-95 ml-auto"
                                            onClick={() => setProgPctAdded(1)}
                                          >
                                            Reset (1%)
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Tanggal Laporan */}
                                      <div className="space-y-1.5">
                                        <Label htmlFor="progDate" className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                                          <Calendar className="h-4 w-4 text-[#8FAF9A]" />
                                          Tanggal Laporan
                                        </Label>
                                        <Input
                                          id="progDate"
                                          type="date"
                                          required
                                          className="border-[#D6DED2] focus-visible:ring-2 focus-visible:ring-[#4F6F52]/20 h-10 text-xs rounded-xl bg-white/80 font-medium"
                                          value={progDate}
                                          onChange={(e) => setProgDate(e.target.value)}
                                          disabled={submitting}
                                        />
                                      </div>

                                      {/* Photo Upload Dropzone with Instant Preview */}
                                      <div className="space-y-1.5">
                                        <label className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                                          <Camera className="h-4 w-4 text-[#8FAF9A]" />
                                          Foto Dokumentasi Progres Lapangan
                                        </label>
                                        <div 
                                          onClick={() => document.getElementById('prog-photo-upload')?.click()}
                                          className="border-2 border-dashed border-[#8FAF9A]/40 hover:border-[#4F6F52]/60 bg-[#F7F8F3]/40 hover:bg-[#8FAF9A]/5 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group"
                                        >
                                          <input
                                            id="prog-photo-upload"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                              if (e.target.files) {
                                                const filesArray = Array.from(e.target.files);
                                                setProgFiles(prev => [...prev, ...filesArray]);
                                                const newUrls = filesArray.map(file => URL.createObjectURL(file));
                                                setProgUploadedPhotos(prev => [...prev, ...newUrls]);
                                              }
                                            }}
                                            disabled={submitting}
                                          />
                                          <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="p-2.5 bg-white rounded-full shadow-md text-[#4F6F52] group-hover:scale-110 transition-transform duration-300 border border-[#D6DED2]">
                                              <Plus className="h-4 w-4" />
                                            </div>
                                            <span className="text-xs font-bold text-[#243028]">Klik atau seret foto ke sini untuk mengunggah</span>
                                            <span className="text-[10px] text-slate-500 font-medium">Maksimal 4 foto, format JPG/PNG/WebP, max 5MB</span>
                                          </div>
                                        </div>

                                        {progUploadedPhotos.length > 0 && (
                                          <div className="grid grid-cols-4 gap-3.5 pt-2">
                                            {progUploadedPhotos.map((photo, index) => (
                                              <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-[#8FAF9A]/30 shadow-sm animate-scale-in">
                                                <Image src={photo} alt={`Preview ${index}`} fill className="object-cover" />
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setProgFiles(prev => prev.filter((_, i) => i !== index));
                                                    setProgUploadedPhotos(prev => prev.filter((_, i) => i !== index));
                                                  }}
                                                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 rounded-full text-white transition-all duration-200 hover:scale-110 shadow-sm"
                                                >
                                                  <XCircle className="h-4 w-4" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Catatan Tambahan */}
                                      <div className="space-y-1.5">
                                        <Label htmlFor="progNotes" className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                                          <MessageSquare className="h-4 w-4 text-[#8FAF9A]" />
                                          Catatan Lapangan / Keterangan
                                        </Label>
                                        <Textarea
                                          id="progNotes"
                                          placeholder="Contoh: Pemasangan keramik lantai utama selesai dengan rapi..."
                                          className="border-[#D6DED2] focus-visible:ring-2 focus-visible:ring-[#4F6F52]/20 text-xs rounded-xl min-h-[80px] bg-white/80"
                                          value={progNotes}
                                          onChange={(e) => setProgNotes(e.target.value)}
                                          disabled={submitting}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )
                      )}

                      <DialogFooter className="pt-4 border-t border-[#D6DED2]/40 mt-4 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setActiveDialog(null)}
                          disabled={submitting}
                          className="rounded-xl border-[#D6DED2] text-xs h-10 hover:bg-[#F7F8F3]/50 transition-premium cursor-pointer"
                        >
                          Batal
                        </Button>
                        <Button
                          type="submit"
                          disabled={submitting || !progSpkId || !progWorkItemId || loadingSpkDetails || !!(progWorkItemId && progWorkItems.find(c => c.id === progWorkItemId)?.currentProgress === 100)}
                          className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-10 rounded-xl font-bold text-xs px-4 gap-2 cursor-pointer"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              {uploadingProgressPhoto ? "Mengunggah Foto..." : "Menyimpan..."}
                            </>
                          ) : (
                            "Kirim Progress"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </>
                );
              })()}
            </TabsContent>

            {/* TAB 2: HISTORY */}
            <TabsContent value="history" className="m-0 focus-visible:outline-none p-6 pt-4 max-h-[60vh] overflow-y-auto space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Dokumentasi Log Progres</h4>
                <p className="text-xs text-muted-foreground">Riwayat progres pembangunan dan unggahan foto lapangan untuk unit ini.</p>
              </div>

              {progLogs && progLogs.length > 0 ? (
                (() => {
                  const filteredLogs = progWorkItemId 
                    ? progLogs.filter(l => l.log.workItemId === progWorkItemId)
                    : progLogs;

                  if (filteredLogs.length === 0) {
                    return (
                      <div className="text-center py-10 border border-dashed border-[#8FAF9A]/30 rounded-2xl text-xs text-muted-foreground">
                        Belum ada riwayat progres tercatat untuk komponen pekerjaan yang dipilih.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 pt-1">
                      {filteredLogs.map((item: any) => {
                        return (
                          <div key={item.log.id} className="p-3.5 bg-[#8FAF9A]/5 border border-[#8FAF9A]/20 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between items-center font-bold text-foreground">
                              <span className="text-[#4F6F52]">{item.workItem?.name || "Komponen Pekerjaan"}</span>
                              <Badge className="bg-[#DDE8D8] text-[#4F6F52] font-semibold border border-[#8FAF9A]/25 rounded-md hover:bg-[#DDE8D8]">
                                +{item.log.percentageAdded}% &rarr; {item.log.currentTotalPct}%
                              </Badge>
                            </div>
                            <div className="text-muted-foreground leading-relaxed">
                              {item.log.notes ? `"${item.log.notes}"` : <span className="italic">Tidak ada catatan lapangan.</span>}
                            </div>

                            {/* Linked Progress Photos */}
                            {((item.attachments && item.attachments.length > 0) || (item.attachment && item.attachment.fileUrl)) && (
                              <div className="pt-1.5">
                                <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block mb-1.5">Bukti Foto Fisik</span>
                                <div className="flex flex-wrap gap-2">
                                  {item.attachments && item.attachments.length > 0 ? (
                                    item.attachments.map((att: any, idx: number) => (
                                      <div key={att.id || idx} className="relative h-24 w-36 rounded-lg overflow-hidden border border-[#8FAF9A]/30 group shadow-sm bg-white cursor-zoom-in">
                                        <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                                          <Image 
                                            src={att.fileUrl} 
                                            alt={`Bukti Progress ${idx + 1}`} 
                                            fill 
                                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                                          />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                                            Buka Foto {idx + 1}
                                          </div>
                                        </a>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="relative h-24 w-36 rounded-lg overflow-hidden border border-[#8FAF9A]/30 group shadow-sm bg-white cursor-zoom-in">
                                      <a href={item.attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <Image 
                                          src={item.attachment.fileUrl} 
                                          alt="Bukti Progress" 
                                          fill 
                                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                                          Buka Foto
                                        </div>
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="text-[10px] text-muted-foreground pt-1 text-right font-medium">
                              Dicatat tanggal: {new Date(item.log.progressDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-10 border border-dashed border-[#8FAF9A]/30 rounded-2xl text-xs text-muted-foreground">
                  Belum ada log progres pembangunan tercatat untuk unit SPK ini.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Tambah Kendala */}
      <Dialog open={activeDialog === "complaint"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white border border-[#D6DED2] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-[#2C3E2D] font-black tracking-tight text-lg">Laporkan Kendala Pekerjaan</DialogTitle>
              <DialogDescription className="text-xs text-[#66736A] mt-1">Laporkan kendala fisik atau material yang menghambat pembangunan.</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleComplaintSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl flex items-center gap-2 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="compSpkIndex">Pilih SPK Unit</Label>
                <Select value={compSpkIndex} onValueChange={(val) => setCompSpkIndex(val || "")} disabled={submitting}>
                  <SelectTrigger id="compSpkIndex" className="rounded-xl border-[#DDE8D8] text-xs w-full flex items-center justify-between">
                    <SelectValue placeholder="Pilih unit SPK terkait...">
                      {compSpkIndex ? (() => {
                        const selectedSpk = spks[parseInt(compSpkIndex)];
                        return selectedSpk ? `${selectedSpk.spkNumber} - Kav. ${selectedSpk.unitCode} (${selectedSpk.projectName})` : compSpkIndex;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 border-[#DDE8D8]">
                    {spks.map((spk, idx) => (
                      <SelectItem key={spk.id} value={idx.toString()} className="text-xs">
                        {spk.spkNumber} - Kav. {spk.unitCode} ({spk.projectName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="compTitle">Judul Kendala</Label>
                <Input
                  id="compTitle"
                  type="text"
                  placeholder="Contoh: Keterlambatan pengiriman semen..."
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  disabled={submitting}
                  className="rounded-xl border-[#DDE8D8] text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="compCategory">Kategori Kendala</Label>
                <Select value={compCategory} onValueChange={(val: any) => setCompCategory(val || "material")} disabled={submitting}>
                  <SelectTrigger id="compCategory" className="rounded-xl border-[#DDE8D8] text-xs w-full flex items-center justify-between">
                    <SelectValue placeholder="Kategori kendala...">
                      {compCategory === "material" && "Kekurangan Material"}
                      {compCategory === "cuaca" && "Cuaca Buruk"}
                      {compCategory === "tenaga_kerja" && "Kekurangan Pekerja"}
                      {compCategory === "akses_lokasi" && "Akses Lokasi Terhambat"}
                      {compCategory === "revisi_desain" && "Revisi Gambar / Desain"}
                      {compCategory === "menunggu_instruksi" && "Menunggu Instruksi"}
                      {compCategory === "kendala_teknis" && "Kendala Teknis Lapangan"}
                      {compCategory === "lainnya" && "Kendala Lain-Lain"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 border-[#DDE8D8]">
                    <SelectItem value="material" className="text-xs">Kekurangan Material</SelectItem>
                    <SelectItem value="cuaca" className="text-xs">Cuaca Buruk</SelectItem>
                    <SelectItem value="tenaga_kerja" className="text-xs">Kekurangan Pekerja</SelectItem>
                    <SelectItem value="akses_lokasi" className="text-xs">Akses Lokasi Terhambat</SelectItem>
                    <SelectItem value="revisi_desain" className="text-xs">Revisi Gambar / Desain</SelectItem>
                    <SelectItem value="menunggu_instruksi" className="text-xs">Menunggu Instruksi</SelectItem>
                    <SelectItem value="kendala_teknis" className="text-xs">Kendala Teknis Lapangan</SelectItem>
                    <SelectItem value="lainnya" className="text-xs">Kendala Lain-Lain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="compDescription">Deskripsi Kendala</Label>
                <Textarea
                  id="compDescription"
                  placeholder="Detail kendala yang dihadapi di lapangan..."
                  value={compDescription}
                  onChange={(e) => setCompDescription(e.target.value)}
                  disabled={submitting}
                  className="rounded-xl border-[#DDE8D8] text-xs min-h-[80px]"
                />
              </div>
            
            <DialogFooter className="pt-4 border-t border-[#D6DED2] gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDialog(null)}
                disabled={submitting}
                className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50 transition-premium cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting || !compSpkIndex || !compDescription}
                className="bg-[#A94A4A] hover:bg-[#8A3B3B] text-white active:scale-95 shadow-[0_4px_14px_rgba(169,74,74,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Melaporkan...
                  </>
                ) : (
                  "Kirim Laporan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Ajukan BAST */}
      <Dialog open={activeDialog === "bast"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white border border-[#D6DED2] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-[#2C3E2D] font-black tracking-tight text-lg">Ajukan BAST Vendor</DialogTitle>
              <DialogDescription className="text-xs text-[#66736A] mt-1">Unggah dokumen Berita Acara Serah Terima (BAST) untuk disetujui Pengawas.</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleBastSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl flex items-center gap-2 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="bastSpkId">Pilih SPK Unit Selesai</Label>
                <Select value={bastSpkId} onValueChange={(val) => setBastSpkId(val || "")} disabled={submitting}>
                  <SelectTrigger id="bastSpkId" className="rounded-xl border-[#DDE8D8] text-xs w-full flex items-center justify-between">
                    <SelectValue placeholder="Pilih SPK dengan progress 100%...">
                      {bastSpkId ? (() => {
                        const selectedBast = basts.find(b => b.spkId === bastSpkId);
                        return selectedBast ? `${selectedBast.spkNumber} - Kav. ${selectedBast.unitCode} (${selectedBast.projectName})` : bastSpkId;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 border-[#DDE8D8]">
                    {basts
                      .filter(b => b.statusCode === "not_submitted")
                      .map((b) => (
                        <SelectItem key={b.spkId} value={b.spkId} className="text-xs">
                          {b.spkNumber} - Kav. {b.unitCode} ({b.projectName})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {basts.filter(b => b.statusCode === "not_submitted").length === 0 && (
                  <p className="text-[10px] text-amber-600">Tidak ada unit selesai (100%) yang belum diajukan BAST.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bastFile">Unggah Berkas PDF BAST</Label>
                <Input
                  id="bastFile"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setBastFile(e.target.files?.[0] || null)}
                  disabled={submitting}
                  className="rounded-xl border-[#DDE8D8] text-xs bg-white file:mr-2 file:py-0 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-[#DDE8D8] file:text-[#4F6F52] file:cursor-pointer hover:file:bg-[#DDE8D8]/80 transition-all h-9 flex items-center pr-2"
                />
              </div>
            
            <DialogFooter className="pt-4 border-t border-[#D6DED2] gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDialog(null)}
                disabled={submitting}
                className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50 transition-premium cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting || !bastSpkId || !bastFile}
                className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-5 gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    {uploadingBastPdf ? "Mengunggah PDF..." : "Mengirim..."}
                  </>
                ) : (
                  "Kirim Pengajuan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
