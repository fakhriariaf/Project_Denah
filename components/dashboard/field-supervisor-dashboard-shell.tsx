"use client";

import React, { useState } from "react";
import { 
  Briefcase, 
  Home, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Plus, 
  Check, 
  Loader2, 
  CheckCircle,
  FileCheck,
  AlertCircle,
  MapPin,
  Eye,
  Layers,
  Map,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Search
} from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  completeConstruction
} from "@/server/actions/production";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorComplaintReviewDialog } from "./vendor-complaint-review-dialog";
import { CustomerComplaintResolveDialog } from "./customer-complaint-resolve-dialog";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getComplaintStatusLabel } from "@/lib/label-helpers";

interface FieldSupervisorDashboardShellProps {
  data: {
    metrics: {
      activeSpks: number;
      unitsBuilding: number;
      recentProgress: number; // Progress Terbaru (last 3 days)
      overdueSpks: number;
      pendingBast: number;
    };
    spks: Array<{
      id: string;
      spkNumber: string;
      title: string;
      projectName: string;
      unitId: string;
      unitCode: string;
      currentCustomerId: string | null;
      vendorName: string;
      progressPct: number;
      startDate: Date;
      targetEndDate: Date;
      status: string;
    }>;
    recentLogs: Array<{
      id: string;
      spkNumber: string;
      unitCode: string;
      projectName: string;
      workItemName: string;
      percentageAdded: number;
      currentTotalPct: number;
      progressDate: Date;
      notes: string | null;
      creatorName: string;
      vendorName: string;
    }>;
    vendorComplaints: Array<{
      id: string;
      complaintNumber: string;
      customerName: string;
      unitCode: string;
      projectName: string;
      category: string;
      description: string;
      status: string;
      createdAt: any;
      spkId: string | null;
      spkNumber: string;
      spkTitle: string;
      spkTargetEndDate: any;
    }>;
    customerComplaints: Array<{
      id: string;
      complaintNumber: string;
      customerName: string;
      unitCode: string;
      projectName: string;
      category: string;
      description: string;
      status: string;
      createdAt: any;
    }>;
    basts: Array<{
      spkId: string;
      spkNumber: string;
      unitId: string;
      unitCode: string;
      projectName: string;
      vendorName: string;
      statusText: string;
      statusCode: string;
      attachmentId: string | null;
      attachmentUrl: string | null;
      attachmentName: string | null;
      uploadedAt: Date | null;
      currentCustomerId: string | null;
    }>;
    projects: Array<{
      id: string;
      code: string;
      name: string;
      location: string | null;
    }>;
  };
  userName: string;
}

export function FieldSupervisorDashboardShell({ data, userName }: FieldSupervisorDashboardShellProps) {
  const router = useRouter();
  const { metrics, spks, recentLogs, vendorComplaints, customerComplaints, basts, projects } = data;

  // Active Dialog States
  const [activeDialog, setActiveDialog] = useState<"approve_bast" | null>(null);
  
  // Selection States
  const [selectedBast, setSelectedBast] = useState<any | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [openVendorDialog, setOpenVendorDialog] = useState(false);
  const [openCustomerDialog, setOpenCustomerDialog] = useState(false);

  // Collapsible state for Recent Logs (Grouped by Project -> Unit)
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [logSearchQuery, setLogSearchQuery] = useState("");

  const toggleProject = (projectName: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectName]: prev[projectName] === false
    }));
  };

  const toggleUnit = (projectUnitKey: string) => {
    setExpandedUnits(prev => ({
      ...prev,
      [projectUnitKey]: prev[projectUnitKey] === false
    }));
  };

  // Filter logs based on search query
  const filteredLogs = React.useMemo(() => {
    if (!logSearchQuery.trim()) return recentLogs;
    const q = logSearchQuery.toLowerCase();
    return recentLogs.filter(log => 
      (log.projectName || "").toLowerCase().includes(q) ||
      (log.unitCode || "").toLowerCase().includes(q) ||
      (log.workItemName || "").toLowerCase().includes(q) ||
      (log.notes && log.notes.toLowerCase().includes(q)) ||
      (log.creatorName || "").toLowerCase().includes(q) ||
      (log.vendorName || "").toLowerCase().includes(q)
    );
  }, [recentLogs, logSearchQuery]);

  // Group logs by project name and unit code
  const groupedLogs = React.useMemo(() => {
    const groups: Record<string, Record<string, typeof recentLogs>> = {};
    for (const log of filteredLogs) {
      const proj = log.projectName || "Lain-Lain";
      const unit = log.unitCode || "Tanpa Kavling";
      if (!groups[proj]) {
        groups[proj] = {};
      }
      if (!groups[proj][unit]) {
        groups[proj][unit] = [];
      }
      groups[proj][unit].push(log);
    }
    return groups;
  }, [filteredLogs]);

  // Expand / Collapse all helper functions
  const expandAll = () => {
    const projState: Record<string, boolean> = {};
    const unitState: Record<string, boolean> = {};
    
    Object.entries(groupedLogs).forEach(([projName, unitsMap]) => {
      projState[projName] = true;
      Object.keys(unitsMap).forEach(unitCode => {
        const unitKey = `${projName}-${unitCode}`;
        unitState[unitKey] = true;
      });
    });
    
    setExpandedProjects(projState);
    setExpandedUnits(unitState);
  };

  const collapseAll = () => {
    const projState: Record<string, boolean> = {};
    const unitState: Record<string, boolean> = {};
    
    Object.entries(groupedLogs).forEach(([projName, unitsMap]) => {
      projState[projName] = false;
      Object.keys(unitsMap).forEach(unitCode => {
        const unitKey = `${projName}-${unitCode}`;
        unitState[unitKey] = false;
      });
    });
    
    setExpandedProjects(projState);
    setExpandedUnits(unitState);
  };
  
  // Loading & Msg states
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle BAST Approval Click
  const handleApproveBastClick = (bast: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedBast(bast);
    setActiveDialog("approve_bast");
  };

  const handleConfirmApproveBast = async () => {
    if (!selectedBast) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await completeConstruction(selectedBast.unitId, selectedBast.attachmentId);
      if (!res.success) {
        throw new Error("Gagal menyetujui BAST.");
      }
      setSuccessMsg("BAST berhasil disetujui! Status unit kini Tersedia Siap Huni.");
      setTimeout(() => {
        setActiveDialog(null);
        setSelectedBast(null);
        setSuccessMsg(null);
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyetujui BAST.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle complaint action trigger
  const handleComplaintAction = (c: any, type: "vendor" | "customer") => {
    setSelectedComplaint(c);
    if (type === "vendor") {
      setOpenVendorDialog(true);
    } else {
      setOpenCustomerDialog(true);
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

  const activeSpksList = spks.filter(s => s.status === "active" || s.status === "proses_konstruksi" || s.status === "overdue");

  return (
    <div className="space-y-6 bg-[#F7F8F3] min-h-screen p-1 md:p-4 relative">
      {/* Background Decor Blurs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#8FAF9A]/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-[#DDE8D8]/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* 1. Header Banner with Glassmorphic Gradient Mesh */}
      <div className="relative overflow-hidden rounded-3xl border border-[#D6DED2]/85 bg-gradient-to-r from-[#DDE8D8]/80 via-white/90 to-white/40 p-6 md:p-8 backdrop-blur-md shadow-[0_8px_32px_rgba(143,175,154,0.06)] animate-in fade-in duration-500">
        {/* Animated Background Orbs */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#8FAF9A]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-[#DDE8D8]/30 blur-3xl pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#4F6F52]/10 px-3.5 py-1 text-[10px] font-bold tracking-wider text-[#4F6F52] uppercase font-sans">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4F6F52] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4F6F52]"></span>
              </span>
              Field Control Center
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#243028] font-sans">
              Dasbor <span className="bg-gradient-to-r from-[#4F6F52] to-[#8FAF9A] bg-clip-text text-transparent">Pengawas Lapangan</span>
            </h2>
            <p className="text-xs md:text-sm text-[#66736A] font-semibold">
              Selamat datang, <span className="text-[#4F6F52] font-bold">{userName}</span>. Kelola dan pantau seluruh pembangunan fisik unit perumahan.
            </p>
          </div>
          
          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2.5 shrink-0 self-start md:self-center">
            <Link href="/production">
              <Button className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.35)] hover:shadow-[0_6px_20px_rgba(79,111,82,0.45)] transition-all duration-300 text-xs font-bold h-11 px-5 rounded-2xl">
                <Layers className="mr-2 h-4 w-4 shrink-0" /> Manajemen Konstruksi
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Five Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Card 1: SPK Aktif */}
        <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#4F6F52]" />
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">SPK Aktif</CardDescription>
            <div className="p-2 bg-[#4F6F52]/5 text-[#4F6F52] rounded-xl group-hover:scale-110 group-hover:bg-[#4F6F52] group-hover:text-white transition-all duration-300">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-[#243028] font-mono tracking-tight tabular-nums">{metrics.activeSpks}</div>
          </CardContent>
        </Card>

        {/* Card 2: Unit Pembangunan */}
        <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-500" />
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Unit Pembangunan</CardDescription>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
              <Home className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-[#243028] font-mono tracking-tight tabular-nums">{metrics.unitsBuilding}</div>
          </CardContent>
        </Card>

        {/* Card 3: Progress Terbaru */}
        <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Progress Terbaru</CardDescription>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight tabular-nums">
              {metrics.recentProgress} <span className="text-[10px] text-[#66736A] font-normal tracking-normal">(3 hari)</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: SPK Terlambat */}
        <Card className="rounded-3xl border border-rose-200/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgb(215,122,122,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group hover:border-rose-300">
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">SPK Terlambat</CardDescription>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-rose-600 font-mono tracking-tight tabular-nums">{metrics.overdueSpks}</div>
          </CardContent>
        </Card>

        {/* Card 5: Pending BAST */}
        <Card className="rounded-3xl border border-[#D6DED2]/80 bg-white/70 backdrop-blur-md shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.12)] hover:-translate-y-1.5 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardDescription className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending BAST</CardDescription>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-[#243028] font-mono tracking-tight tabular-nums">{metrics.pendingBast}</div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Siteplan Quick View Grid */}
      <div className="space-y-3.5">
        <h3 className="text-sm font-black text-[#243028] uppercase tracking-wider flex items-center gap-1.5 px-1 font-sans">
          <Map className="w-4.5 h-4.5 text-[#4F6F52]" /> Akses Cepat Siteplan Proyek
        </h3>
        <div className="flex flex-wrap gap-4">
          {projects.map((proj) => (
            <Link key={proj.id} href={`/siteplan/${proj.id}`} className="w-full sm:w-[320px] flex">
              <Card className="relative overflow-hidden border border-[#D6DED2]/80 bg-white/70 hover:bg-white hover:border-[#8FAF9A]/60 hover:shadow-[0_10px_25px_rgba(79,111,82,0.06)] hover:-translate-y-1 active:scale-98 transition-all duration-300 rounded-[22px] cursor-pointer w-full shadow-sm group">
                {/* Accent top gradient bar */}
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#8FAF9A] to-[#4F6F52] opacity-70 group-hover:opacity-100 transition-opacity" />
                
                {/* Content padding wrapper to override card's flex-col */}
                <div className="p-4.5 flex items-center justify-between w-full gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Project Icon Container */}
                    <div className="h-10 w-10 rounded-2xl bg-[#4F6F52]/5 text-[#4F6F52] flex items-center justify-center shrink-0 group-hover:bg-[#4F6F52] group-hover:text-white transition-all duration-300 shadow-inner">
                      <MapPin className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-xs font-black text-[#243028] group-hover:text-[#4F6F52] transition-colors truncate pr-1">
                        {proj.name}
                      </h4>
                      <p className="text-[10px] text-[#66736A] font-bold flex items-center gap-1 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#8FAF9A]" />
                        {proj.location || "Lokasi Proyek"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Modern visual button */}
                  <div className="inline-flex items-center gap-1 rounded-full bg-[#4F6F52]/10 px-3 py-1.5 text-[10px] font-black text-[#4F6F52] group-hover:bg-[#4F6F52] group-hover:text-white transition-all duration-300 shrink-0 shadow-sm">
                    <span>Buka</span>
                    <span className="font-mono group-hover:translate-x-0.5 transition-transform duration-200">&rarr;</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 4. Main Sections Layout - Row 1: Pekerjaan Berjalan & Kendala */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Side: Pekerjaan Konstruksi Berjalan (lg:col-span-2) */}
        <div className="lg:col-span-2 flex">
          <Card className="w-full border border-[#D6DED2]/85 bg-white/70 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300 overflow-hidden flex flex-col">
            <CardHeader className="border-b border-[#D6DED2]/85 p-5 bg-[#DDE8D8]/20 shrink-0">
              <CardTitle className="text-base font-bold text-[#243028] flex items-center gap-2 font-sans">
                <Briefcase className="w-5 h-5 text-[#4F6F52]" /> Pekerjaan Konstruksi Berjalan
              </CardTitle>
              <CardDescription className="text-xs text-[#66736A] font-medium">Seluruh SPK aktif di bawah pengawasan proyek Anda.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-grow flex flex-col">
              {activeSpksList.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#66736A] italic font-medium flex-grow flex items-center justify-center">Tidak ada pekerjaan konstruksi berjalan saat ini.</div>
              ) : (
                <div className="divide-y divide-[#D6DED2]/60 flex-grow">
                  {activeSpksList.map((spk) => (
                    <div key={spk.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-[#DDE8D8]/10 transition-colors duration-250">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-[#4F6F52] bg-[#DDE8D8]/45 px-2.5 py-0.5 rounded-lg border border-[#8FAF9A]/20">
                            {spk.spkNumber}
                          </span>
                          <span className="text-xs font-extrabold text-[#243028] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#8FAF9A]" /> Kav. {spk.unitCode} &bull; {spk.projectName}
                          </span>
                          {getStatusBadge(spk.status)}
                        </div>
                        <h4 className="text-sm font-black text-[#243028] pt-0.5">{spk.title}</h4>
                        <div className="text-[11px] text-[#66736A] flex flex-wrap gap-x-4 gap-y-1 font-semibold">
                          <span>Vendor: <span className="text-[#4F6F52] font-bold">{spk.vendorName}</span></span>
                          <span>Target: <span className="font-mono">{new Date(spk.targetEndDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 min-w-[170px]">
                        <div className="w-full space-y-1.5">
                          <div className="flex justify-between text-xs font-bold text-[#243028]">
                            <span>Progres</span>
                            <span className="font-mono">{spk.progressPct}%</span>
                          </div>
                          <Progress value={spk.progressPct} className="h-2 bg-slate-100/80 [&>div]:bg-[#4F6F52]" />
                        </div>
                        <Link href={`/production`}>
                          <Button variant="ghost" size="icon" className="text-[#4F6F52] hover:bg-[#DDE8D8]/40 hover:text-[#3D563F] rounded-xl active:scale-95 transition-all">
                            <Eye className="w-5 h-5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Kendala / Komplain Unit (lg:col-span-1) */}
        <div className="lg:col-span-1 flex">
          <Card className="w-full border border-[#D6DED2]/85 bg-white/70 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300 overflow-hidden flex flex-col">
            <CardHeader className="border-b border-[#D6DED2]/85 p-5 bg-[#DDE8D8]/20 shrink-0">
              <CardTitle className="text-base font-bold text-[#243028] flex items-center gap-2 font-sans">
                <AlertCircle className="w-5 h-5 text-[#4F6F52]" /> Laporan Masalah &amp; Komplain
              </CardTitle>
              <CardDescription className="text-xs text-[#66736A] font-medium">
                Pantau kendala konstruksi vendor &amp; komplain unit dari konsumen.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-grow flex flex-col">
              <Tabs defaultValue="vendor" className="w-full flex-grow flex flex-col">
                <TabsList className="grid grid-cols-2 w-full rounded-xl bg-[#F7F8F3] border border-[#D6DED2]/60 p-1 mb-4">
                  <TabsTrigger value="vendor" className="rounded-lg text-xs font-bold py-1.5 transition-all flex items-center justify-center gap-1.5 data-active:bg-[#4F6F52] data-active:text-white">
                    Kendala Vendor
                    {vendorComplaints.length > 0 && (
                      <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-none font-mono text-[9px] font-bold h-4.5 px-1.5 py-0 rounded-full flex items-center justify-center">
                        {vendorComplaints.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="customer" className="rounded-lg text-xs font-bold py-1.5 transition-all flex items-center justify-center gap-1.5 data-active:bg-[#4F6F52] data-active:text-white">
                    Komplain Konsumen
                    {customerComplaints.length > 0 && (
                      <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-none font-mono text-[9px] font-bold h-4.5 px-1.5 py-0 rounded-full flex items-center justify-center">
                        {customerComplaints.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Kendala Vendor */}
                <TabsContent value="vendor" className="flex-grow overflow-y-auto space-y-4 max-h-[360px] pr-1 scrollbar-thin">
                  {vendorComplaints.length === 0 ? (
                    <div className="text-center text-xs text-[#66736A] italic py-8 font-medium">
                      Tidak ada kendala vendor aktif.
                    </div>
                  ) : (
                    vendorComplaints.map((c) => {
                      const categoryLabels: Record<string, string> = {
                        material: "Kekurangan Material",
                        cuaca: "Cuaca Buruk",
                        tenaga_kerja: "Kekurangan Pekerja",
                        akses_lokasi: "Akses Lokasi Terhambat",
                        revisi_desain: "Revisi Gambar / Desain",
                        menunggu_instruksi: "Menunggu Instruksi",
                        kendala_teknis: "Kendala Teknis Lapangan",
                        lainnya: "Kendala Lain-Lain",
                      };
                      return (
                        <div key={c.id} className="p-3.5 bg-white border border-[#D6DED2]/85 hover:border-[#8FAF9A]/60 rounded-2xl space-y-2.5 transition-all hover:shadow-md">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono text-[9px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 uppercase tracking-wider">
                              {c.complaintNumber}
                            </span>
                            <Badge className="bg-amber-500/10 text-amber-800 border border-amber-200/50 text-[9px] font-extrabold uppercase py-0.5 px-2 rounded-full shadow-none">
                              {getComplaintStatusLabel(c.status)}
                            </Badge>
                          </div>
                          <div>
                            <h5 className="text-xs font-extrabold text-[#2C3E2D]">
                              Kav. {c.unitCode} &bull; <span className="text-[#4F6F52]">{categoryLabels[c.category] || c.category}</span>
                            </h5>
                            <p className="text-[11px] text-[#5C6E5D] leading-relaxed pt-0.5 font-semibold">SPK: {c.spkTitle}</p>
                            <p className="text-[11px] text-[#66736A] leading-relaxed pt-1.5 italic">"{c.description}"</p>
                          </div>
                          <div className="flex justify-end items-center pt-2 border-t border-slate-100">
                            <Button
                              size="sm"
                              onClick={() => handleComplaintAction(c, "vendor")}
                              className="h-7 text-[10px] px-3.5 bg-[#4F6F52] hover:bg-[#3D563F] text-white rounded-lg font-bold transition-all duration-200 active:scale-95"
                            >
                              Proses &amp; Review
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                {/* Tab 2: Komplain Konsumen */}
                <TabsContent value="customer" className="flex-grow overflow-y-auto space-y-4 max-h-[360px] pr-1 scrollbar-thin">
                  {customerComplaints.length === 0 ? (
                    <div className="text-center text-xs text-[#66736A] italic py-8 font-medium">
                      Tidak ada komplain konsumen aktif.
                    </div>
                  ) : (
                    customerComplaints.map((c) => {
                      const categoryLabels: Record<string, string> = {
                        bangunan: "Fisik Bangunan / Plafon / Dinding",
                        serah_terima: "BAST / Serah Terima",
                        listrik_air: "Instalasi Air / Listrik",
                        legalitas: "Legalitas Sertifikat / PBB",
                        fasilitas: "Fasilitas Umum / Kawasan",
                        pelayanan: "Pelayanan Staff",
                        after_sales: "Garansi Pemeliharaan",
                        lainnya: "Lain-lain",
                      };
                      return (
                        <div key={c.id} className="p-3.5 bg-white border border-[#D6DED2]/85 hover:border-[#8FAF9A]/60 rounded-2xl space-y-2.5 transition-all hover:shadow-md">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono text-[9px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase tracking-wider">
                              {c.complaintNumber}
                            </span>
                            <Badge className="bg-rose-500/10 text-rose-800 border border-rose-200/50 text-[9px] font-extrabold uppercase py-0.5 px-2 rounded-full shadow-none">
                              {getComplaintStatusLabel(c.status)}
                            </Badge>
                          </div>
                          <div>
                            <h5 className="text-xs font-extrabold text-[#2C3E2D]">
                              Kav. {c.unitCode} &bull; <span className="text-[#A94A4A]">{categoryLabels[c.category] || c.category}</span>
                            </h5>
                            <p className="text-[11px] text-[#66736A] leading-relaxed pt-1.5 italic">"{c.description}"</p>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                            <span className="text-[9px] text-[#66736A] font-bold">
                              Konsumen: <span className="text-[#2C3E2D] font-bold">{c.customerName}</span>
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleComplaintAction(c, "customer")}
                              className="h-7 text-[10px] px-3.5 bg-[#4F6F52] hover:bg-[#3D563F] text-white rounded-lg font-bold transition-all duration-200 active:scale-95"
                            >
                              Tindak Lanjut
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Row 2: Progress Terbaru & BAST Vendor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Side: Progress Terbaru (lg:col-span-2) */}
        <div className="lg:col-span-2 flex">
          <Card className="w-full border border-[#D6DED2]/85 bg-white/70 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300 overflow-hidden flex flex-col">
            <CardHeader className="border-b border-[#D6DED2]/85 p-5 bg-[#DDE8D8]/20 shrink-0">
              <CardTitle className="text-base font-bold text-[#243028] flex items-center gap-2 font-sans">
                <Layers className="w-5 h-5 text-[#4F6F52]" /> Progress Terbaru (Log Aktivitas)
              </CardTitle>
              <CardDescription className="text-xs text-[#66736A] font-medium">Riwayat update persentase pembangunan fisik dari lapangan.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5 flex-grow flex flex-col">
              {recentLogs.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#66736A] italic font-medium flex-grow flex items-center justify-center">
                  Belum ada pembaruan progres log dilaporkan.
                </div>
              ) : (
                <div className="flex flex-col flex-grow">
                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4 border-b border-[#D6DED2]/50 pb-4 shrink-0">
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#66736A]" />
                      <Input
                        placeholder="Cari perumahan, kavling, atau item..."
                        value={logSearchQuery}
                        onChange={(e) => setLogSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs border-[#D6DED2] focus-visible:ring-ring bg-white rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={expandAll}
                        className="text-xs h-8 px-3 rounded-xl border-[#D6DED2] text-[#4F6F52] hover:bg-[#DDE8D8]/20 hover:text-[#3D563F] font-bold flex items-center gap-1.5 active:scale-95 transition-all duration-200"
                      >
                        Expand Semua
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={collapseAll}
                        className="text-xs h-8 px-3 rounded-xl border-[#D6DED2] text-[#66736A] hover:bg-slate-50 font-bold flex items-center gap-1.5 active:scale-95 transition-all duration-200"
                      >
                        Collapse Semua
                      </Button>
                    </div>
                  </div>

                  {filteredLogs.length === 0 ? (
                    <div className="p-12 text-center text-xs text-[#66736A] italic font-medium flex-grow flex items-center justify-center">
                      Tidak ada hasil pencarian yang cocok dengan "{logSearchQuery}".
                    </div>
                  ) : (
                    <div className="space-y-4 flex-grow">
                      {Object.entries(groupedLogs).map(([projectName, unitsMap]) => {
                        const isProjExpanded = expandedProjects[projectName] !== false;
                        const totalUnitLogs = Object.values(unitsMap).reduce((sum, list) => sum + list.length, 0);

                        return (
                          <div key={projectName} className="border border-[#D6DED2] rounded-2xl overflow-hidden bg-white/40 shadow-sm transition-all duration-205">
                            {/* Project Header Accordion */}
                            <div 
                              onClick={() => toggleProject(projectName)}
                              className="flex items-center justify-between p-4 bg-gradient-to-r from-[#DDE8D8]/50 to-transparent hover:from-[#DDE8D8]/80 cursor-pointer transition-all duration-205 border-b border-[#D6DED2]/40 select-none group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-[#4F6F52]/10 text-[#4F6F52] flex items-center justify-center shrink-0 shadow-inner group-hover:bg-[#4F6F52] group-hover:text-white transition-colors duration-200">
                                  <MapPin className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <h4 className="text-xs font-black text-[#243028] tracking-tight">{projectName}</h4>
                                  <p className="text-[10px] text-[#66736A] font-bold">{Object.keys(unitsMap).length} Kavling &bull; {totalUnitLogs} Log Update</p>
                                </div>
                              </div>
                              
                              <div className="text-slate-400 group-hover:text-[#4F6F52] transition-colors p-1">
                                {isProjExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-[#4F6F52]" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-[#66736A]" />
                                )}
                              </div>
                            </div>

                            {/* Units list under Project */}
                            {isProjExpanded && (
                              <div className="p-4 space-y-3.5 bg-[#F7F8F3]/30">
                                {Object.entries(unitsMap).map(([unitCode, logs]) => {
                                  const unitKey = `${projectName}-${unitCode}`;
                                  const isUnitExp = expandedUnits[unitKey] !== false;
                                  const maxProgress = Math.max(...logs.map(l => l.currentTotalPct));

                                  return (
                                    <div key={unitCode} className="border border-[#D6DED2]/60 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-200">
                                      {/* Unit Header Accordion */}
                                      <div 
                                        onClick={() => toggleUnit(unitKey)}
                                        className="flex items-center justify-between p-3.5 hover:bg-slate-50 cursor-pointer transition-all select-none border-b border-dashed border-[#D6DED2]/30 group/unit"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover/unit:bg-[#DDE8D8]/50 group-hover/unit:text-[#4F6F52] transition-colors">
                                            <Home className="w-4 h-4" />
                                          </div>
                                          <div>
                                            <span className="text-xs font-black text-[#243028]">Kavling {unitCode}</span>
                                            <span className="text-[10px] text-muted-foreground ml-2 font-medium">({logs.length} update)</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                          <Badge className="bg-[#DDE8D8] text-[#4F6F52] hover:bg-[#DDE8D8] font-mono text-[9px] font-bold border border-[#8FAF9A]/30">
                                            Progres: {maxProgress}%
                                          </Badge>
                                          <div className="text-slate-400 group-hover/unit:text-[#4F6F52] transition-colors">
                                            {isUnitExp ? (
                                              <ChevronUp className="h-4.5 w-4.5 text-[#4F6F52]" />
                                            ) : (
                                              <ChevronRight className="h-4.5 w-4.5 text-[#66736A]" />
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Logs under Unit */}
                                      {isUnitExp && (
                                        <div className="divide-y divide-[#D6DED2]/40 bg-slate-50/40">
                                          {logs.map((log) => (
                                            <div key={log.id} className="p-4 hover:bg-[#DDE8D8]/5 transition-colors duration-200 flex items-start justify-between gap-4">
                                              <div className="space-y-2 flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-xs font-extrabold text-[#243028]">{log.workItemName}</span>
                                                </div>
                                                {log.notes && (
                                                  <div className="text-xs text-[#5C6E5D] bg-white px-3.5 py-2.5 rounded-xl border border-[#D6DED2]/40 italic font-medium shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)] leading-relaxed">
                                                    "{log.notes}"
                                                  </div>
                                                )}
                                                <div className="text-[10px] text-[#66736A] flex items-center gap-2 font-semibold pt-1 flex-wrap">
                                                  <span className="h-4.5 w-4.5 rounded-full bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center text-[7.5px] font-black uppercase shrink-0">
                                                    {log.creatorName.slice(0, 2)}
                                                  </span>
                                                  <span>Dilaporkan: {log.creatorName}</span>
                                                  <span>&bull;</span>
                                                  <span>Vendor: <span className="text-[#4F6F52] font-black">{log.vendorName}</span></span>
                                                  <span>&bull;</span>
                                                  <span className="font-mono">{new Date(log.progressDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}</span>
                                                </div>
                                              </div>
                                              <Badge className="bg-[#DDE8D8] text-[#243028] hover:bg-[#DDE8D8] font-mono text-[9px] font-bold shrink-0 border border-[#8FAF9A]/30">
                                                +{log.percentageAdded}% ({log.currentTotalPct}%)
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Verifikasi BAST Vendor (lg:col-span-1) */}
        <div className="lg:col-span-1 flex">
          <Card className="w-full border border-[#D6DED2]/85 bg-white/70 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgba(143,175,154,0.05)] hover:shadow-[0_12px_40px_rgba(143,175,154,0.1)] transition-all duration-300 overflow-hidden flex flex-col">
            <CardHeader className="border-b border-[#D6DED2]/85 p-5 bg-[#DDE8D8]/20 shrink-0">
              <CardTitle className="text-base font-bold text-[#243028] flex items-center gap-2 font-sans">
                <FileCheck className="w-5 h-5 text-[#4F6F52]" /> Verifikasi BAST Vendor
              </CardTitle>
              <CardDescription className="text-xs text-[#66736A] font-medium">Review dokumen BAST Kontraktor untuk disetujui menjadi Tersedia Siap Huni.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-grow flex flex-col">
              {basts.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#66736A] italic font-medium flex-grow flex items-center justify-center">Belum ada unit yang diajukan BAST.</div>
              ) : (
                <div className="divide-y divide-[#D6DED2]/60 flex-grow">
                  {basts.map((b) => (
                    <div key={b.spkId} className="p-4.5 space-y-3.5">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="space-y-0.5">
                          <h5 className="text-xs font-black text-[#243028]">{b.projectName} &bull; Kav. {b.unitCode}</h5>
                          <p className="text-[10px] text-[#66736A] font-semibold">Kontraktor: <span className="text-[#4F6F52] font-bold">{b.vendorName}</span></p>
                        </div>
                        {b.statusCode === "approved" ? (
                          <Badge className="bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30 text-[9px] font-extrabold uppercase px-2 rounded-full">Disetujui</Badge>
                        ) : b.statusCode === "pending" ? (
                          <Badge className="bg-amber-500/10 text-amber-800 border border-amber-200/50 text-[9px] font-extrabold uppercase px-2 rounded-full animate-pulse">Menunggu Approval</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 border border-gray-200 text-[9px] font-extrabold uppercase px-2 rounded-full">Belum Diajukan</Badge>
                        )}
                      </div>
 
                      {b.statusCode === "pending" ? (
                        <div className="space-y-2.5">
                          <div className="bg-[#F7F8F3] rounded-xl p-2.5 border border-[#D6DED2]/60 flex items-center justify-between gap-2.5">
                            <span className="text-[10px] text-[#66736A] font-bold truncate max-w-[150px] font-mono">
                              {b.attachmentName || "BAST_Vendor.pdf"}
                            </span>
                            <a
                              href={b.attachmentUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black text-[#4F6F52] hover:text-[#3D563F] hover:underline shrink-0"
                            >
                              Buka PDF
                            </a>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleApproveBastClick(b)}
                            className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs h-8.5 rounded-xl flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(79,111,82,0.2)] font-bold transition-all duration-200 active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5 text-white" /> Approve BAST &amp; Set Ready
                          </Button>
                        </div>
                      ) : (
                        b.attachmentUrl && (
                          <div className="bg-[#F7F8F3] rounded-xl p-2.5 border border-[#D6DED2]/60 flex items-center justify-between gap-2.5">
                            <span className="text-[10px] text-[#66736A] font-bold truncate max-w-[150px] font-mono">
                              {b.attachmentName || "BAST_Vendor.pdf"}
                            </span>
                            <a
                              href={b.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black text-[#4F6F52] hover:text-[#3D563F] hover:underline shrink-0"
                            >
                              Lihat PDF
                            </a>
                          </div>
                        )
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
      {/* 5. DIALOG MODALS */}
      {/* ============================================================== */}

      {/* Modal 1: Approve BAST Confirmation */}
      <Dialog open={activeDialog === "approve_bast"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-lg sm:max-w-lg w-full bg-white/95 rounded-[24px] border border-[#D6DED2]/85 backdrop-blur-md shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="relative overflow-hidden rounded-t-2xl border-b border-[#D6DED2]/60 bg-gradient-to-r from-[#DDE8D8]/60 via-white/80 to-transparent p-6">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#4F6F52]/5 rounded-full blur-xl pointer-events-none" />
            <DialogTitle className="text-base font-extrabold text-[#243028] flex items-center gap-2 font-sans">
              <FileCheck className="w-5 h-5 text-[#4F6F52]" />
              Persetujuan BAST &amp; Siap Huni
            </DialogTitle>
            <DialogDescription className="text-xs text-[#66736A] font-medium pt-1">
              Anda akan menyetujui dokumen BAST fisik kontraktor secara resmi.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl flex items-center gap-2 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" /> {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl flex items-center gap-2 text-xs font-semibold">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" /> {successMsg}
              </div>
            )}

            {selectedBast && (
              <div className="bg-[#F7F8F3] border border-[#D6DED2]/60 rounded-2xl p-4.5 space-y-3.5 text-xs text-[#5C6E5D]">
                <div className="grid grid-cols-3 gap-y-2.5">
                  <span className="font-bold text-[#66736A]">SPK</span>
                  <span className="col-span-2 font-mono text-[#243028] font-bold">{selectedBast.spkNumber}</span>
                  
                  <span className="font-bold text-[#66736A]">Proyek</span>
                  <span className="col-span-2 text-[#243028] font-bold">{selectedBast.projectName}</span>
                  
                  <span className="font-bold text-[#66736A]">Kavling Unit</span>
                  <span className="col-span-2 font-mono text-[#243028] font-bold">Kav. {selectedBast.unitCode}</span>
                  
                  <span className="font-bold text-[#66736A]">Kontraktor</span>
                  <span className="col-span-2 text-[#4F6F52] font-bold">{selectedBast.vendorName}</span>
                </div>
                <div className="pt-3 border-t border-[#D6DED2]/60 text-[10px] text-rose-600 font-bold leading-normal flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>
                    {selectedBast.currentCustomerId ? (
                      "Tindakan ini akan memverifikasi selesainya pembangunan fisik lapangan secara resmi. Karena unit ini telah terikat dengan konsumen, status unit akan tetap terikat dan tidak menjadi Tersedia Siap Huni."
                    ) : (
                      "Tindakan ini akan memindahkan status unit secara resmi menjadi Tersedia Siap Huni di peta siteplan dan database."
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-[#F7F8F3]/75 border-t border-[#D6DED2]/50 p-4 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveDialog(null)}
              disabled={submitting}
              className="border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold px-4 h-9 active:scale-95 transition-all"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmApproveBast}
              disabled={submitting}
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white rounded-xl text-xs font-bold px-5 h-9 active:scale-95 transition-all shadow-[0_4px_12px_rgba(79,111,82,0.25)]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Memproses...
                </>
              ) : (
                "Ya, Approve BAST"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendor & Customer Complaint Dialogs */}
      <VendorComplaintReviewDialog
        complaint={selectedComplaint}
        open={openVendorDialog}
        onClose={() => { setOpenVendorDialog(false); setSelectedComplaint(null); }}
        onSuccess={() => { router.refresh(); }}
      />
      
      <CustomerComplaintResolveDialog
        complaint={selectedComplaint}
        open={openCustomerDialog}
        onClose={() => { setOpenCustomerDialog(false); setSelectedComplaint(null); }}
        onSuccess={() => { router.refresh(); }}
      />
    </div>
  );
}
